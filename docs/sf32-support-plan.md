# Spark 支持 SF32（T-Display SF32）固件 —— 方案

> 状态：**Phase 1 已实现（未提交）**；Phase 2（一键烧录）不做，由用户自行刷机。调研日期 2026-10-29。
>
> **Phase 1 实施与本文方案的差异：** zip **原样存储**，不再在服务端规范化为 `sf32.json` + 三件套。
> - 原因：用户自己刷机，保留 Cairn 自带的一键安装器体验最好；sha256 与发布方 `SHA256SUMS.txt` 一致，去重天然稳定。
> - 服务端仍会解析并校验三件套，把结果记入 manifest 的 `chip: "SF32LB52"` 和 `sf32_package: { layout, installer, images[] }`。
> - 不再引入 `post_erase` 字段（属于烧录逻辑，Phase 1 不需要）。
> - 存储方式与 `.bin` 一致：再包一层 zip，新老客户端走同一条下载路径。
> 目标用例：用户把 Cairn（MeshCore 分支）的 T-Display SF32 固件上传到 Spark，能正常上传、审核、上架，最终能在 Spark 里一键烧录。

---

## 1. 现状：为什么现在会报错

上传链路有三处硬编码了 ESP32：

| 位置 | 代码 | 对 SF32 的结果 |
|---|---|---|
| 客户端 `src/components/FirmwareUpload.tsx:228`、`:512`、`:569` | 只接受 `.bin` | Cairn 发布的是 `-install.zip`，选不进来 |
| 服务端 `LILYGO-Spark-Server/src/routes/upload.ts:186` | `ext !== '.bin'` 直接返回 400 | 拒绝 |
| 服务端 `src/utils/firmware.ts` `FirmwareValidator.validate` | 在 0x0/0x1000/0x2000 处检查 `0xE9` | SF32 镜像开头是 Cortex-M 向量表（`00 20 xx 20 ...`），返回 **"Invalid firmware file (bad magic byte)"**，这就是用户看到的报错 |

另外，数据模型也只能描述 ESP32 固件：

- manifest 中每个固件条目就是 **一个文件、一个 sha256**。烧录时 `BurnerModal` 固定把它写到 `0x0000`，并用 esptool 烧录。
- SF32 必须同时烧 **三个文件、三个地址**，还要换一套烧录工具。
- 线上 manifest（`firmware_manifest.json`，478 条）里 **还没有任何 SF32 产品**。

顺带发现一个已有问题：上传表单里的 `flash_path` 只写进了 upload record（`path: flash_path || '0x0'`）。`addFirmwareToManifest` 没有把它带进 manifest，所以线上 478 条全部没有 `path` 字段。这个和本次需求无关，但 SF32 的方案会用 `images[].addr` 来表达地址，不再依赖这个字段。

---

## 2. SF32 固件长什么样（已下载核实）

资料来源（都已下载到本地并校验）：

- Cairn 仓库 `cvhviz/Cairn`，release `cairn-v125`。文件包括 `MeshCore-TDisplaySF32-Cairn125-2026-10-29-install.zip`（29 MB）、`-update.bin`、`SHA256SUMS.txt`，SHA256 全部与 `SHA256SUMS.txt` 一致。
- LilyGO 官方仓库 `Xinyuan-LilyGO/T-Display-SF32`，路径 `firmware/T-SF32-Factory-V1.5.5`、`T-SF32-Factory-Keyboard-V1.5.5` 和 `unit_test/*`。

### 2.1 镜像布局（Cairn 与官方出厂固件完全一致）

| 文件 | 烧录地址 | 大小（Cairn 125 / 出厂 1.5.5） | 特征 |
|---|---|---|---|
| `ftab.bin` | `0x12000000` | 11288 / 11288 | 开头 4 字节为 `"FCES"`（`46 43 45 53`） |
| `bootloader.bin` | `0x12010000` | 58616 / 57612 | 向量表：SP=0x2004xxxx，Reset=0x2002xxxx（在 RAM 中运行） |
| `main.bin` | `0x12020000` | 2287024 / 2342416 | 向量表：SP=0x2000xxxx，Reset=0x1202xxxx\|1（XIP flash） |

- 官方目录里附带 `ImgBurnList.ini`，内容是 `FILE0=bootloader\bootloader.bin ADDR0=0x12010000 ...`，可以直接用它解析地址。
- Cairn 的 zip 结构是 `firmware/{bootloader,main,ftab}.bin`，另外还有 `firmware/escaped/`、`firmware/restore.txt` 和 `tools/`（sftool 三平台二进制、`sf32link.py`、pyserial）。
- Cairn 的 `-update.bin` 与 `main.bin` **逐字节相同**，它是给板子 Wi-Fi OTA 用的，单独拿它不能完成首次安装。
- 官方 Keyboard 版目录还带一个 `ESP32C6/factory_ESP32C6-4MB.bin`，这是键盘板上 ESP32-C6 的固件，属于另一颗芯片，不在本次范围内。

### 2.2 关键坑：sftool 直接烧录会卡死（这是 Cairn 自写安装器的原因）

SF32LB52 的 ROM 里有一个 UART 调试引擎（Debug IP）。它和 RAM flash stub **共用 USART1**。sftool 0.2.5 的行为是：

1. 先通过调试引擎把 stub 加载进 RAM；
2. 然后发送调试 Exit 帧，**但不读回复**。在 macOS 上这次写入本身还可能报 `Broken pipe`。

如果调试模式其实没有退出，写入的固件数据流里只要出现以下字节序列，就会被调试引擎当成命令执行，stub 随之卡死，只能断电恢复：

- `7E 79`：调试帧头
- `40 72`：MEMRead
- `40 77`：MEMWrite
- `ATSF32\x05!`、`ATSF32\x18!`：Enter / Exit 载荷

我自己写了一个扫描脚本（没有运行下载来的代码），结果是：

| 镜像 | 7E79 | 4072 | 4077 |
|---|---|---|---|
| Cairn 125 `main.bin` | 4 | 9 | 5 |
| 出厂 1.5.5 `main.bin` | 9 | 13 | 7 |
| 出厂 Keyboard 1.5.5 `main.bin` | 9 | 14 | 9 |
| 各 `bootloader.bin` / `ftab.bin` | 0 | 0 | 0 |

**结论：不只是 Cairn，官方出厂固件也会踩这个坑。** 这和 LilyGO README 里"烧录超时请重插 USB"的现象吻合。

上游状态：

- sftool issue #55、PR #56（"escape SF32LB52 debug markers during flash writes"）**仍为 open**；
- 最新版本仍是 0.2.5（2026-06-26）。

所以短期内不能指望直接调用 sftool 就稳定。

### 2.3 Cairn 的"安全烧录"流程（`sf32link.py`，MIT 协议）

```
prep      若板上跑的是 Cairn（提示符 "msh />"），发送 flashprep：充电器不断电、关看门狗、保持唤醒；
          回复 NOBATT 则停止（电源开关没开或电池没电）
escape    把每个危险字节改成 0xFF（Pair 型改第 2 个字节，Payload 型改第 1 个字节；
          这些模式本身都不含 0xFF，所以改完不会产生新的危险序列），并记录 (offset, 原值)
sftool --before no_reset --after no_reset read_flash probe@0x12000000:0x10      ← 借这一步加载 stub
exit      发送 Exit 帧 7E 79 08 00 10 00 'ATSF32' 18 21，等待 D0 06 回复；
          没有回复时再发一次 framed read 探测，确认调试模式已关闭；最后确认 stub 提示符 "msh >"
pending   (可选) 对每个文件执行 stub 命令 burn_verify addr size crc，已一致的文件跳过
sftool --before no_reset_no_sync --after no_reset write_flash esc/bootloader.bin@0x12010000 esc/main.bin@0x12020000 esc/ftab.bin@0x12000000
restore   对每个被改过的字节执行 stub 命令 burn_write_muti_bytes 1 <addr> <byte>，
          最后用 burn_verify 以真实 CRC 校验整个文件
sftool --before no_reset_no_sync --after soft_reset erase_region 0x12700000:0x2000   ← 仅 Cairn：清除 OTA 槽记录，然后重启
```

- CRC 算法：`zlib.crc32(data, 0xFFFFFFFF) ^ 0xFFFFFFFF`，检验值 `"123456789"` → `0x2DFD2D88`。
- 串口固定 1 Mbaud，DTR=RTS=low（不会触发复位）。**不能用 `-b` 降速**，否则 stub 卡住后只会以那个速率应答。

**可用来做 golden test 的数据**：Cairn 的 `restore.txt` 给出了 `main.bin` 的 18 个 patch（offset、原值），以及 real/escaped CRC（`0x36ba4a32` / `0x562f087c`）。我的扫描结果正好是 4+9+5=18 个，能对上。

### 2.4 硬件注意事项（必须在 UI 上提示用户）

- 电源开关必须拨到 **ON**，并接上有电的电池。否则 stub 接管后板子每 20–40 秒重启一次，烧录失败。这一点 LilyGO README 也写了。
- 刷机前把核心板从键盘底座上拆下来，用 USB-C 数据线直连电脑。
- USB 桥接芯片是 CH343，VID:PID = `1a86:55d3`。注意不少 LilyGO 的 ESP32 板也用 WCH 芯片，**不能只靠 VID/PID 判断是不是 SF32**。
- 下载模式在 ROM 里，烧录失败不会变砖。恢复方法：按住 A 键 12 秒，或断电 5 秒。

---

## 3. 方案总览

按聊天里的约定分两期：**"先把上传上了，刷机不着急，起码不报错"**。

- **Phase 1（上传 + 上架 + 下载，不报错）**：服务端和客户端都能识别 SF32 固件包；能审核、上架；在产品页显示，并能下载固件包。烧录按钮先给出指引（Cairn 安装器或 sftool 命令）。
- **Phase 2（Spark 内一键烧录）**：Electron 主进程自带 sftool，并用 TypeScript 重写 Cairn 的 exit/escape/restore 安全流程。

### 3.1 统一的数据格式："SF32 bundle"

用 **一个 zip** 来表示一个 SF32 固件。这样不破坏现有"一条固件 = 一个 OSS 文件 + 一个 sha256"的模型，去重、审核、评论、统计这些逻辑都可以原样复用。

由服务端规范化生成的 bundle 结构：

```
<name>.sf32.zip
├── sf32.json          # 描述文件（见下）
├── ftab.bin
├── bootloader.bin
└── main.bin
```

```jsonc
// sf32.json
{
  "format": "spark-sf32-bundle-1",
  "chip": "SF32LB52",
  "images": [
    { "file": "ftab.bin",       "addr": "0x12000000", "size": 11288,   "sha256": "...", "crc32": "0x72986741" },
    { "file": "bootloader.bin", "addr": "0x12010000", "size": 58616,   "sha256": "...", "crc32": "0xedc6921a" },
    { "file": "main.bin",       "addr": "0x12020000", "size": 2287024, "sha256": "...", "crc32": "0x36ba4a32" }
  ],
  "post_erase": ["0x12700000:0x2000"],   // 可选，Cairn 包才有（清 OTA 记录），管理员审核时可见可改
  "source_format": "cairn-install-zip"   // cairn-install-zip | lilygo-imgburnlist | loose-bins
}
```

- **确定性打包**：固定文件顺序、固定 mtime、固定压缩参数。这样同一组镜像总是得到同一个 sha256，现有的 SHA256 去重和 "merge product IDs" 逻辑可以直接沿用。
- **只保留固件本身**：sftool、python、`escaped/` 一律丢弃。Cairn 包从 29 MB 缩到约 2.3 MB，而且不会把第三方可执行文件存进我们的 OSS。

manifest 条目新增字段（老字段保持不变）：

```jsonc
{
  "filename": "MeshCore-TDisplaySF32-Cairn125-2026-10-29.sf32.zip",
  "chip": "SF32LB52",
  "flash_format": "sf32-bundle",
  "images": [ /* 与 sf32.json 相同 */ ],
  "post_erase": ["0x12700000:0x2000"],
  // oss_url / sha256 / size / md5 等照旧，sha256 指 bundle 本身
}
```

**老客户端兼容性**：老客户端会把 bundle 当成普通 zip 下载，然后按 `originalFilename` 在 zip 里找文件。找不到时会抛出 `No matching file found in zip archive`，这一步发生在调用 esptool **之前**，所以会安全失败，不会把 SF32 镜像写进 ESP32。如果想更彻底，可以再加一个 `min_spark_version` 字段，新客户端会识别它（见第 6 节问题 4）。

### 3.2 产品数据（运营操作，不需要改代码）

通过 ProductManager 在 T-Display Series 下新增产品：

- `product_id: t-display-sf32`，`mcu: SF32LB52`，`github_repo: Xinyuan-LilyGO/T-Display-SF32`
- 键盘版用同一个 product 即可，出厂固件分 "Keyboard" / 非 Keyboard 两条

客户端用 `mcu` 以 `SF32` 开头来判断走哪条路径（上传表单、烧录器），不额外引入 chip 枚举。

---

## 4. Phase 1：上传与上架（目标：不报错）

### 4.1 服务端 `LILYGO-Spark-Server`

1. **`src/utils/firmware.ts`**：新增 `Sf32BundleBuilder` 和 `Sf32ImageValidator`：
   - 输入为上传的 zip，支持三种来源结构：
     - (a) Cairn install.zip：取 `*/firmware/{bootloader,main,ftab}.bin`，忽略 `escaped/`；
     - (b) 带 `ImgBurnList.ini` 的 LilyGO 目录（打成 zip）：按 ini 解析文件和地址；
     - (c) 三个散文件：按文件名匹配默认地址。
   - 每个镜像都要校验：`ftab` 以 `FCES` 开头；`bootloader` 的 SP 在 `0x2000_0000–0x2008_0000`、Reset 在 RAM；`main` 的 SP 在 RAM、Reset 在 `0x1200_0000–0x1300_0000` 且为奇数（Thumb）；大小不超过对应分区（以 ftab 的分区表为准，至少要小于下一个镜像的起始地址）。
   - 拒绝只有 `main.bin` 的上传（例如 Cairn 的 `-update.bin`）。这个文件依赖 Cairn 自己的 bootloader，单独刷入不安全。错误信息要写清楚："SF32 需要 ftab/bootloader/main 三件套，请上传 install.zip"。
   - 检测到 Cairn 来源（存在 `restore.txt` 或文件名匹配 `MeshCore-TDisplaySF32-*`）时，自动加上 `post_erase: ["0x12700000:0x2000"]`。
   - 输出确定性的 bundle 文件，以及 `images[]` 元数据（包括 sha256 和 sftool 口径的 crc32）。
2. **`src/routes/upload.ts` `/firmware`**：
   - 扩展名允许 `.bin` 和 `.zip`。如果是 `.zip`，或请求带 `chip=SF32LB52`，就走 SF32 分支：先 `Sf32BundleBuilder.build()`，后续的哈希、OSS 和 record 处理都基于规范化之后的 bundle。
   - bundle 本身就是 zip，**不要再套一层** `compressZip`。OSS key 用 `firmware/<sha16>_<name>.sf32.zip`。
   - upload record 增加 `chip`、`flash_format`、`images`、`post_erase` 字段，供管理员审核时查看。
   - 普通 `.zip`（不是 SF32）仍然拒绝，避免扩大攻击面。
   - 解压要加防护：限制条目数（≤ 64）、限制单个文件解压后的大小（≤ 16 MB，也就是 flash 大小）和总大小、禁止路径穿越，防止 zip bomb。
3. **`addFirmwareToManifest`**：把 `chip`、`flash_format`、`images`、`post_erase` 写进新条目。manifest v2（`services/manifestV2.ts`）同步写入。
4. 单元测试：
   - 用 Cairn 125 install.zip 和出厂 1.5.5 目录做 fixture，验证规范化结果和 sha256 稳定；
   - 构造坏样本：缺文件、魔数错误、zip bomb、只有 main.bin。

### 4.2 客户端 `LILYGO-Spark`

1. **`FirmwareUpload.tsx`**：
   - `accept=".bin,.zip"`。选中的产品是 SF32 产品、或文件是 `.zip` 时，进入 "SF32 模式"。
   - 在主进程新增 IPC `inspect-sf32-package`（复用已有的 `adm-zip`），在本地预先解析一遍，在表单里展示三件套、地址和大小。解析失败当场报错，不用等上传后服务端返回 400。
   - 上传前在本地剥离 `tools/` 和 `escaped/`，只上传固件部分（约 2.3 MB，而不是 29 MB）。服务端会再规范化一次，不依赖客户端的处理结果。
   - 文件名默认值、"Only .bin files" 等提示文案需要相应调整，四种语言的 i18n 都要改。
2. **`firmwareAnalyzer.ts` / `FirmwareAnalyzerTool`**：识别 SF32 镜像（`FCES` 或 Cortex-M 向量表特征），显示 "SF32LB52 image"，不再报 "missing 0xE9 magic"。
3. **`FirmwareCommunity` 和产品页**：对 `flash_format === 'sf32-bundle'` 的条目：
   - 下载：`handleDownloadFirmware` 新增分支，把整个 bundle 解压到 cacheDir，返回目录和 `images[]`；
   - 烧录按钮：Phase 1 先弹出指引弹窗，包括第 2.4 节的硬件注意事项、"打开下载目录"、Cairn 安装器链接和手动 sftool 命令。
4. **`BurnerModal`**：遇到 SF32 条目时 **禁止** 进入 esptool 流程，作为兜底防护。

**Phase 1 验收**：
- 用 Cairn 125 install.zip 和 LilyGO 出厂目录 zip 上传都能成功；
- 管理员审核通过后，在 T-Display SF32 产品下能看到这些固件，下载得到正确的三件套，SHA 校验一致；
- 老版本客户端点烧录时会安全失败，不会写入任何数据。

---

## 5. Phase 2：Spark 内一键烧录

### 5.1 工具打包

- 使用 OpenSiFli sftool **0.2.5** 官方 release，许可证 Apache-2.0：
  - `resources/tools/mac/sftool-{arm64,x64}`，打包时用 lipo 合成通用二进制，做法和现有 esptool 一致；`scripts/afterSign.js` 里补上签名和 notarize；
  - `resources/tools/win/sftool.exe`；
  - `resources/tools/linux/sftool`。
- 把 sftool 的 LICENSE 加进 THIRD_PARTY_NOTICES。
- 构建脚本校验 release 的 `.sha256`。
- **不打包 Python。** `sf32link.py` 的逻辑用 TypeScript 重写，放在 Electron 主进程，使用现有的 `serialport` 依赖。Cairn 是 MIT 协议，在文件头注明出处。

### 5.2 新模块 `electron/sf32/`

```
electron/sf32/
├── hazards.ts      findHazards / escape（纯函数，可单测）
├── crc.ts          sftool CRC32（纯函数）
├── link.ts         串口 1 Mbaud、DTR/RTS=low；debug frame 编解码；exitDebug()；stub shell：
│                   shellPrompt / stubCmd / burnVerify / burnWriteByte
├── sftool.ts       定位二进制、spawn，解析 stdout 中的进度，处理超时和取消
└── flasher.ts      编排完整流程，向 UI 推送阶段和进度
```

`flasher.ts` 的流程：

```
0. 预检：确认端口是 1a86:55d3（只给提示，不阻断）；打开端口失败 → "端口被占用"
1. probe：发送 CR LF，读取提示符
   - "msh />"（Cairn）→ 发送 flashprep；NOBATT → 中止，提示打开电源开关或给电池充电
   - "msh >"（stub 残留）→ 跳到第 4 步
   - 没有应答 → 提示用户"按住 A 键 12 秒复位"，并等待最多 2 分钟
2. escape：在内存中处理，转义后的文件写到临时目录
3. sftool read_flash（加载 stub），--before no_reset --after no_reset
4. exitDebug()，确认 → shellPrompt === 'stub'，否则中止（错误码与 sf32link 对齐）
5. pending：用 burnVerify 跳过已经一致的镜像（Cairn → Cairn 升级时很快）
6. sftool write_flash 写入转义后的镜像，--before no_reset_no_sync --after no_reset
7. restore：burnWriteByte 写回逐个 patch → 用真实 CRC 做 burnVerify
8. 如果 bundle 带 post_erase：sftool erase_region，--after soft_reset；否则执行 stub burn_reset
任一步失败 → 整体最多重试 3 次（流程可重入，重跑是安全的）；完整日志写入 logger
```

### 5.3 UI

- `BurnerModal` 中 SF32 条目走 `Sf32FlashPanel`：
  - 隐藏 esptool / esptool-js 选择和波特率选择（必须固定 1 Mbaud）；
  - 开始前显示必须勾选的检查清单：电源开关 ON、已拆下键盘、使用数据线直连；
  - 显示阶段进度：准备 → 加载 stub → 退出调试 → 写入 → 校验 → 重启。
- `Burner`（本地文件烧录页）的芯片下拉框加入 `SF32LB52`，可以选本地 zip 或目录。这一项可以放到 Phase 2 后半段。
- 出错时给出可操作的提示，文案参考 Cairn 文档里的故障表。

### 5.4 测试

- **单元测试（不需要硬件）**：
  - `findHazards(Cairn main.bin)` 必须与 `restore.txt` 的 18 条 patch 逐条一致；
  - escape 之后的 CRC 等于 `0x562f087c`，真实 CRC 等于 `0x36ba4a32`；
  - CRC 检验值 `0x2DFD2D88`；
  - 用 mock 串口回放 Exit、D0 06 应答、stub 的 OK/Fail 回复。
- **硬件测试矩阵**（需要找对方要板子，聊天里对方说过"需要测试的话你跟我说一下"）：
  - 出厂 → Cairn、Cairn → Cairn（pending 跳过）、Cairn → 出厂、Cairn 有活跃 OTA 槽时刷出厂；
  - 中途拔线后重跑；
  - 电源开关 OFF（应提示 NOBATT 或给出明确失败原因）；
  - macOS arm64/x64、Windows（需要 CH343 驱动）、Linux。

---

## 6. 需要你拍板的问题

1. **分期**：是否认同 Phase 1 只做"上传、上架、下载加指引"，Phase 2 再做一键烧录？
2. **bundle 规范化放在服务端**（我的建议，符合"不信任客户端"），还是只在客户端做？
3. **自己实现安全流程**（TS 重写 exit/escape/restore，加上 sftool 二进制），还是 **等 sftool PR #56 合并后直接调用 sftool**？后者代码少，但上游时间不确定，而且 PR #56 不解决"Exit 不确认"这个问题。我的建议是先自己实现；上游合并后，如果确认能用，可以删掉 escape/restore 部分。
4. **老客户端**：依靠第 3.1 节的"安全失败"就够了，还是额外加 `min_spark_version` 字段并发版强制升级？
5. **是否接受只有 main.bin 的 SF32 上传**（例如 Cairn `-update.bin`）？我的建议是 Phase 1 拒绝。
6. **键盘板上的 ESP32-C6 固件**（`factory_ESP32C6-4MB.bin`）这次不做，可以吗？
7. **flashprep 和 post_erase**：这两步是 Cairn 专用的。我的方案是按 bundle 来源自动判断，管理员审核时可见可改，你看是否可以？

---

## 7. 工作量粗估

| 项 | 估计 |
|---|---|
| Phase 1 服务端（builder、validator、路由、manifest 字段、测试） | 1–1.5 天 |
| Phase 1 客户端（上传表单、IPC 解析、下载分支、指引弹窗、i18n） | 1–1.5 天 |
| Phase 2 sftool 打包（三平台、签名、notarize） | 0.5–1 天 |
| Phase 2 `electron/sf32/*` 加单测 | 1.5–2 天 |
| Phase 2 UI 加硬件联调 | 1–2 天（取决于板子到手时间） |

## 附：本地调研材料

都放在 session scratchpad 中，不在仓库里：

- `scratchpad/ext/Cairn`（Cairn 仓库）
- `scratchpad/ext/dl`（v125 SF32 release 原件和 SHA256SUMS）
- `scratchpad/ext/unz`（install.zip 解压结果）
- `scratchpad/ext/T-Display-SF32`（LilyGO 官方仓库）
