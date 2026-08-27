# dsh-file-upload

A DeepSeek Harness Web plugin that adds an **in-chat file-upload button**. Pick a
local file, it is stored under the agent's session workspace (default
`<cwd>/uploads/`), and a `@"<absolute-path>" 请读取这个文件` reference is appended to
the draft so the agent reads and analyses the file on the next message.

It works for any file type — documents, spreadsheets, images, archives — because
the agent simply reads the saved file with its existing tools (`read`, `glob`,
`pwsh`, …).

## How it works

- **Browser half** (`lib/client.js`): registers an "上传文件 / Upload file" control
  into the `conversation.input.dock` slot. Selecting files POSTs each to the host
  endpoint and shows the saved path as a chip.
- **Host half** (`lib/index.js`): registers `POST /file-upload` on the web server,
  streams the body to `<uploadRoot>/uploads/<name>` (name-collision-safe), and
  returns the absolute path.

The plugin is a dual-face `dsh.client` package (`platform: web`). The host
`dsh-client-modules` plugin scans it, serves `lib/client.js` at
`/plugins/@deepseek-ai/dsh-file-upload/client.js`, and includes it in
`window.__DSH_BOOT__` — so **the existing prebuilt frontend shell needs no rebuild**.

## Install

### On Windows

```powershell
pwsh -File .\scripts\install.ps1
# custom DSH home:
pwsh -File .\scripts\install.ps1 -DshHome "C:\Users\<you>\.dsh"
```

### On macOS / Linux

```bash
./scripts/install.sh
# custom DSH home:
DSH_HOME=/Users/<you>/.dsh ./scripts/install.sh
```

Both scripts are idempotent. They:
1. copy the plugin package into `$DSH_HOME/profiles/node_modules/@deepseek-ai/dsh-file-upload`;
2. append an `file-upload` entry to `$DSH_HOME/profiles/web/cordis.patch.yml` (if absent).

Afterwards, reload the Web browser (`http://127.0.0.1:3080`) or restart `dsh web`.

### Manual (equivalent)

1. Copy this whole package to `$DSH_HOME/profiles/node_modules/@deepseek-ai/dsh-file-upload`.
2. Append to `$DSH_HOME/profiles/web/cordis.patch.yml`:

   ```yaml
   # file-upload plugin
   - insert:
       - id: file-upload
         name: '@deepseek-ai/dsh-file-upload'
   ```

### As a one-off overlay (does not persist)

```bash
dsh --profile web --patch ./file-upload.cordis.patch.yml
```

## Configure the upload directory

By default uploads land under the session workspace's `uploads/` subdirectory.
Point somewhere else by setting `config.uploadRoot` on the `file-upload` row:

```yaml
- insert:
    - id: file-upload
      name: '@deepseek-ai/dsh-file-upload'
      config:
        uploadRoot: 'D:\deepseek'
```

## Requirements

- `@deepseek-ai/dsh` CLI installed, and the `web` profile started at least once
  (so `$DSH_HOME/profiles/web` exists).

## Usage

1. Open `http://127.0.0.1:3080`.
2. Click the **Upload file** button above the composer.
3. Pick one or more local files.
4. The draft gains `@"<path>" 请读取这个文件`; press Send (optionally with a
   question such as "分析这个文件").

## Repository layout

```
package.json                 npm package manifest (dsh.client dual-face)
lib/index.js                 host half: /file-upload endpoint
lib/client.js                browser half: composer upload button
file-upload.cordis.patch.yml overlay that enables the plugin on a web profile
scripts/install.ps1          Windows installer (idempotent)
scripts/install.sh           macOS / Linux installer (idempotent)
```
