# 用 SSH 隧道连接跨网段的浏览器（CDP 端口转发）

适用于：**bi-ji 服务**和**浏览器**不在同一台电脑，且两台电脑不在同一网段、互相访问不到（没有路由、在 NAT 后面等），但至少有一方能发起 SSH 连接到另一方。

例如常见的组合：bi-ji 跑在 Linux 服务器（有公网 IP 或 Windows 能连到它），浏览器跑在你自己的 Windows 电脑上；Windows 能主动连到 Linux，但 Linux 反向连不进 Windows。

## 原理

- 调试浏览器默认只监听自己本机的 `127.0.0.1:9222`（`.bat` 默认配置，最安全，**不需要开防火墙**）。
- 在 Windows 上发起一条 SSH 到 Linux，把「Linux 的 9222 端口」反向转发到「Windows 的 127.0.0.1:9222」。
- 结果：bi-ji 在 Linux 上访问 `http://127.0.0.1:9222`，就等于访问到了 Windows 那台电脑上的浏览器。

```
Linux (bi-ji) ──访问 127.0.0.1:9222──▶ SSH 隧道 ◀──Windows ssh 客户端──▶ 127.0.0.1:9222 (浏览器 CDP)
```

## 步骤

### 0. 前提

- Windows 有 OpenSSH 客户端：Win10/11 自带，先验证：`ssh -V`。没有的话在「设置 → 应用 → 可选功能」里安装「OpenSSH 客户端」（或用 Git Bash）。
- Linux 已开启 sshd（默认端口 22）。
- 建议配置 SSH 密钥免密登录（`ssh-keygen` 生成，把公钥加到 Linux 的 `~/.ssh/authorized_keys`），否则每次建隧道都要输密码。

### 1. 先启动调试浏览器（Windows 那台）

双击 `scripts/start-browser-cdp.bat`（会用独立配置目录 `.biji-browser` 启动 Edge/Chrome）。第一次打开时登录你需要的网站，登录态会一直保存在这个窗口里。**保持窗口开着**。

### 2. 建立反向隧道（在 Windows 上执行）

```bash
ssh -N -R 9222:127.0.0.1:9222 用户名@Linux服务器地址 -o ServerAliveInterval=60 -o ServerAliveCountMax=3
```

参数说明：

- `-N`：只做端口转发，不执行远程命令。
- `-R 9222:127.0.0.1:9222`：让 **Linux** 监听 `9222` 端口，把进入的请求转发到 **Windows** 本机的 `127.0.0.1:9222`（即浏览器 CDP）。
- `-o ServerAliveInterval=60 -o ServerAliveCountMax=3`：定期发心跳，防止隧道因空闲被断开。

验证是否通了：在 **Linux** 上执行

```bash
curl http://127.0.0.1:9222/json/version
```

能返回 JSON 就说明隧道生效。

> 如果反过来是 **Linux 能连到 Windows 的 22 端口**（比如 Windows 有公网 IP），那在 Linux 上用本地转发也行，效果一样：
>
> ```bash
> ssh -N -L 9222:127.0.0.1:9222 用户名@Windows服务器地址 -o ServerAliveInterval=60 -o ServerAliveCountMax=3
> ```
>
> `-L 9222:127.0.0.1:9222`：让 **Linux** 监听 `9222`，转发到 **Windows** 本机的 `127.0.0.1:9222`。选 `-R` 还是 `-L`，取决于哪边能先发起 SSH 连到哪边。

### 3. 在 bi-ji 里配置

设置 → 浏览器控制：

- 打开「启用浏览器控制」开关。
- CDP 调试地址填：`http://127.0.0.1:9222`（Linux 本机即可，隧道会把它接到 Windows 的浏览器）。
- 点「测试连接」确认显示「已连接」，再点「保存」。

之后「Agent 能力」里的 `browser_*` 工具才可勾选，agent 就能读页面 / 点击 / 截图了。

### 4.（可选）让隧道常驻

SSH 连接断了隧道就没了，建议做开机自启或断线重连：

- **最简单**：把命令存成 `cdp-tunnel.bat`，开机（或需要时）双击运行，保持窗口开着。窗口关了隧道就断。
- **更可靠**：在 Windows 上用计划任务 / NSSM 把它做成开机自启的服务，或用支持自动重连的 `autossh`（Linux 端）。
- 可以在步骤 2 的命令前加 `-o ExitOnForwardFailure=yes`，一旦端口绑定失败立即报错而不是静默挂起。

## 常见问题

- **Linux 上 `curl 127.0.0.1:9222` 拒绝连接**：浏览器没启动（回到步骤 1），或隧道已断开（重新执行步骤 2）。
- **端口被占用**：换一个，例如 `-R 19222:127.0.0.1:9222`，同时 bi-ji 地址填 `http://127.0.0.1:19222`。
- **提示 Permission denied / 输密码麻烦**：配置 SSH 密钥免密（步骤 0）。
- **不要特意去开 `0.0.0.0`**：隧道方案下浏览器和隧道都只监听 `127.0.0.1`，不需要改 `BIJI_CDP_ADDR`、不需要放行防火墙，比直接开局域网监听更安全。
- 反向隧道在 Linux 端默认只监听本机回环地址，外部机器访问不到，安全性好；如果 Linux 的 `sshd` 设置了 `GatewayPorts yes` 会监听所有网卡，非必要别开。
