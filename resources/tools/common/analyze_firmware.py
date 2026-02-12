#!/usr/bin/env python3
import sys
import os
import json
import struct

# Add the current directory to sys.path to find esptool and gen_esp32part
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir) # Use insert(0) to prioritize local modules

# Debug: Print sys.path and directory contents
# print(f"DEBUG: sys.path: {sys.path}", file=sys.stderr)
# print(f"DEBUG: contents of {current_dir}: {os.listdir(current_dir)}", file=sys.stderr)

try:
    import esptool
    from esptool.bin_image import LoadFirmwareImage
    from esptool.targets import CHIP_DEFS
    from esptool.loader import ESPLoader
    import gen_esp32part
except ImportError as e:
    # If running from a different directory, try adding the 'tool' subdirectory
    # print(f"DEBUG: Import failed: {e}", file=sys.stderr)
    tool_dir = os.path.join(current_dir, 'tool')
    if os.path.exists(tool_dir):
        sys.path.insert(0, tool_dir)
        try:
            import esptool
            from esptool.bin_image import LoadFirmwareImage
            from esptool.targets import CHIP_DEFS
            from esptool.loader import ESPLoader
            import gen_esp32part
        except ImportError as e2:
             print(json.dumps({"error": f"Failed to import esptool: {str(e2)}. Path: {sys.path}"}))
             sys.exit(1)
    else:
        print(json.dumps({"error": f"Failed to import esptool: {str(e)}. Path: {sys.path}"}))
        sys.exit(1)

def detect_chip_type(filepath):
    try:
        with open(filepath, 'rb') as f:
            # Check magic number
            common_header = f.read(8)
            if len(common_header) < 8: return None
            magic = common_header[0]
            if magic != 0xE9: # ESP_IMAGE_MAGIC
                return None
            
            # Read extended header
            extended_header = f.read(16)
            if len(extended_header) < 16: return None
            
            chip_id = extended_header[4] # Byte 4 is chip_id
            
            # Iterate over CHIP_DEFS to find match
            for chip_name, chip_class in CHIP_DEFS.items():
                if chip_name == "esp8266": continue
                if getattr(chip_class, "IMAGE_CHIP_ID", None) == chip_id:
                    return chip_name
            
            # Fallback for ESP8266 or others if not found above
            # ESP8266 doesn't have extended header chip_id in the same way usually
            return None
    except Exception:
        return None

def analyze_firmware(filepath):
    result = {
        "chip": "Unknown",
        "flash_size": "Unknown",
        "features": [],
        "partitions": [],
        "is_full_image": False,
        "bootloader_info": {}
    }

    try:
        with open(filepath, 'rb') as f:
            data = f.read()
    except Exception as e:
        return {"error": f"Failed to read file: {str(e)}"}

    # 1. Detect Chip
    detected_chip = detect_chip_type(filepath)
    if detected_chip:
        result["chip"] = detected_chip
    
    # 2. Use esptool to parse image if chip is detected
    if detected_chip:
        try:
            image = LoadFirmwareImage(detected_chip, filepath)
            result["flash_mode"] = {0:'QIO', 1:'QOUT', 2:'DIO', 3:'DOUT'}.get(image.flash_mode, str(image.flash_mode))
            
            # Flash Size & Freq
            flash_size_byte = image.flash_size_freq & 0xF0
            flash_freq_byte = image.flash_size_freq & 0x0F
            
            # We need to look up these values. 
            # image.ROM_LOADER.FLASH_SIZES is a dict {name: byte}
            for name, val in image.ROM_LOADER.FLASH_SIZES.items():
                if val == flash_size_byte:
                    result["flash_size"] = name
                    break
            
            for name, val in image.ROM_LOADER.FLASH_FREQUENCY.items():
                if val == flash_freq_byte:
                    result["flash_freq"] = name
                    break
                    
            result["entry_point"] = hex(image.entrypoint)
            result["segments"] = len(image.segments)
            
        except Exception as e:
            result["esptool_error"] = str(e)

    # 3. Basic Header Parsing (Fallback)
    # Map based on esptool.py source
    flash_sizes = {0:'1MB', 1:'2MB', 2:'4MB', 3:'8MB', 4:'16MB', 5:'32MB'} # Basic mapping, might vary by chip
    flash_freqs = {0:'40MHz', 1:'26MHz', 2:'20MHz', 0xf:'80MHz'}

    if result["chip"] == "Unknown" and len(data) > 0 and data[0] == 0xE9:
        try:
            # Basic Header Parsing (Magic, Segments, Flash Mode, Flash Size/Freq, Entry)
            # Byte 3: Flash Mode (0: QIO, 1: QOUT, 2: DIO, 3: DOUT)
            # Byte 4: Flash Size (High 4 bits) + Flash Freq (Low 4 bits)
            flash_id = data[3]
            flash_info = data[4]
            
            flash_mode = {0:'QIO', 1:'QOUT', 2:'DIO', 3:'DOUT'}.get(flash_id, str(flash_id))
            
            flash_size_code = (flash_info & 0xF0) >> 4
            flash_freq_code = flash_info & 0x0F
            
            result["flash_mode"] = flash_mode
            result["flash_size_raw"] = flash_size_code
            result["flash_freq"] = flash_freqs.get(flash_freq_code, f"Unknown({flash_freq_code})")
        except Exception as e:
            result["header_error"] = str(e)


    # 2. Try to detect Extended Header for Chip ID (ESP32 specific)
    # The extended header is usually just after the basic header (24 bytes) if wp_pin is set?
    # Actually, simpler way: check known magic values for bootloaders or partition tables
    
    # 3. Partition Table Scan
    # Partition table magic is 0xAA50
    # Common offsets: 0x8000 (ESP32), 0x9000 (S3/C3/etc, sometimes)
    
    possible_offsets = [0x8000, 0x9000, 0x10000, 0x20000] # Check a few common places
    
    found_partition_table = False
    
    for offset in possible_offsets:
        if len(data) > offset + 2:
            magic = data[offset:offset+2]
            if magic == b'\xaa\x50':
                # Found potential partition table
                try:
                    # Extract 3KB (0xC00) or until end of file
                    pt_data = data[offset:min(len(data), offset + 0xC00)]
                    partitions = []
                    
                    # Parse using gen_esp32part
                    try:
                        table = gen_esp32part.PartitionTable.from_binary(pt_data)
                        partitions = []
                        
                        for p in table:
                            partitions.append({
                                "label": p.name,
                                "type": p.type,
                                "subtype": p.subtype,
                                "offset": hex(p.offset),
                                "size": hex(p.size),
                                "size_dec": p.size,
                                "encrypted": p.encrypted
                            })
                    except Exception:
                         # Fallback to manual parsing if gen_esp32part fails (though it shouldn't if data is valid)
                         # But wait, from_binary raises InputError if invalid.
                         # We should catch it and continue to next offset.
                         raise 

                    
                    if len(partitions) > 0:
                        result["partitions"] = partitions
                        result["is_full_image"] = True
                        found_partition_table = True
                        result["partition_table_offset"] = hex(offset)
                        break
                except Exception as e:
                    # Not a valid partition table
                    pass

    # 4. Chip Detection Heuristics (if esptool failed)
    # ESP32 bootloader (0x1000) usually starts with 0xE9
    # ESP32-S3 bootloader (0x0) starts with 0xE9
    # We can try to guess based on partition table offset if found
    if found_partition_table:
        if result["partition_table_offset"] == "0x8000":
            result["chip_guess"] = "ESP32"
        elif result["partition_table_offset"] == "0x9000":
            result["chip_guess"] = "ESP32-S3/C3/S2 (Likely S3/C3)"
            
    # 5. Bootloader Flash Size (from offset 0x1000 or 0x0 depending on chip)
    # If 0x1000 has magic 0xE9, it's ESP32. Read byte 3 (flash size)
    # If 0x0 has magic 0xE9, it's S3/C3/etc. Read byte 3.
    
    bootloader_flash_size = "Unknown"
    
    # Check offset 0x1000 (ESP32)
    if len(data) > 0x1004 and data[0x1000] == 0xE9:
        fl_info = data[0x1003]
        size_id = (fl_info & 0xF0) >> 4
        bootloader_flash_size = flash_sizes.get(size_id, f"Unknown ID {size_id}")
        if result["chip"] == "Unknown": result["chip"] = "ESP32"

    # Check offset 0x0 (S3/C3/S2)
    elif len(data) > 4 and data[0] == 0xE9:
        fl_info = data[3]
        size_id = (fl_info & 0xF0) >> 4
        bootloader_flash_size = flash_sizes.get(size_id, f"Unknown ID {size_id}")
        # Could be any of S3/C3/S2/H2
        if result["chip"] == "Unknown": result["chip"] = "ESP32-S3/C3/S2"
        
    result["bootloader_flash_size"] = bootloader_flash_size

    return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: analyze_firmware.py <firmware.bin>"}))
        sys.exit(1)
        
    filepath = sys.argv[1]
    if not os.path.exists(filepath):
        print(json.dumps({"error": "File not found"}))
        sys.exit(1)
        
    analysis = analyze_firmware(filepath)
    print(json.dumps(analysis, indent=2))
