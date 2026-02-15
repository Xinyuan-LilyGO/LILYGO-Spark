/** 格式化端口路径：Windows 显示 COMx，macOS/Linux 显示 /dev/xxx */
export function formatPortPath(portName: string): string {
  if (!portName) return portName;
  if (/^COM\d+/i.test(portName)) return portName; // Windows
  if (portName.startsWith('/')) return portName;  // 已是完整路径
  return `/dev/${portName}`;                      // macOS/Linux 补全路径
}

/** 将十六进制大小转为 KB/MB 显示 */
export function hexToHumanSize(hexStr: string): string {
  const n = parseInt(hexStr, 16);
  if (isNaN(n) || n <= 0) return '';
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}
