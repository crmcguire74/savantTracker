# Letting a colleague see it while it runs on your PC

Short version: `npm run dev` is the wrong thing to share. Use
`npm run start:local` instead, then open one Windows firewall port.

---

## Why the dev server is the wrong thing to share

`http://localhost:5173` serves the app from your PC, but the tracker data is
not on your PC. In dev mode it lives in the browser's own storage, on each
person's machine.

So if you share port 5173, your colleague gets the application, and a fresh
empty copy of the data that seeds itself from the bundled snapshot. They will
not see anything you have changed. Two people editing means two separate
trackers that quietly disagree.

`npm run start:local` runs the real Azure server on your PC, with the data in
one JSON file. Everyone pointed at your machine reads and writes the same
tracker. It behaves like the Azure deployment will, which also makes it a
better demo.

---

## Do this

### 1. Build and start the shared server

In your project folder:

```powershell
npm install
npm run build
npm run start:local
```

It prints something like:

```
Savant Strategic Initiatives Tracker
  local:    http://localhost:8080
  network:  http://<this-machine-ip>:8080
  storage:  C:\...\savant-tracker\local-data\tracker.json
  sign-in:  NONE. Anyone who can reach this port can edit the tracker.
```

First run seeds the file with your 43 projects. After that it uses whatever
is in the file, so edits survive a restart.

### 2. Find your IP address

```powershell
ipconfig
```

Look for **IPv4 Address** under your active adapter. Something like
`10.4.22.117`. Use the wired or wifi adapter, not a VPN or virtual one unless
your colleague is on the same VPN.

### 3. Open the port in Windows Firewall

PowerShell, **Run as Administrator**:

```powershell
New-NetFirewallRule -DisplayName "Savant Tracker 8080" `
  -Direction Inbound -Protocol TCP -LocalPort 8080 `
  -Profile Domain -Action Allow
```

`-Profile Domain` limits this to the corporate network. It will not open the
port on a coffee shop wifi.

If you are not a local administrator on your machine, this is where you stop
and ask IT. There is no way around it.

Remove it when you are done:

```powershell
Remove-NetFirewallRule -DisplayName "Savant Tracker 8080"
```

### 4. Send the link

```
http://10.4.22.117:8080
```

Your IP, port 8080. They need to be on the Savant network or VPN. Leave the
terminal window open. Closing it stops the server.

---

## What they will see

The tracker, with your data, editable. No sign-in, because there is none.

Everyone is treated as an editor, so anyone who opens that link can change
anything. Each person is asked to set a name, which is what shows up in the
change log. Ask them to type their real name so the log stays useful.

---

## When it does not work

**"This site can't be reached."**
Three things to check, in order:

1. Is the server still running? The terminal window has to stay open.
2. Can they reach your machine at all? Have them run `ping 10.4.22.117`. No
   reply means the network is blocking machine-to-machine traffic, which many
   corporate wifi networks do on purpose. Wired usually works where wifi does
   not.
3. Firewall rule. Confirm with
   `Get-NetFirewallRule -DisplayName "Savant Tracker 8080"`.

**They see the tracker but not your changes.**
You are still sharing the dev server on 5173. Stop it and use
`npm run start:local` on 8080.

**"Blocked request. This host is not allowed."**
That is the Vite dev server again. It permits IP addresses but rejects
machine names. Another reason to use the real server instead.

---

## If you did want to share the dev server anyway

For a quick look at the interface with nobody caring about the data:

```powershell
npm run dev -- --host
```

Then the same firewall rule on port 5173. Understand that each viewer gets
their own private copy of the data, and none of it is yours.

---

## What not to do

Do not use ngrok, Cloudflare Tunnel, VS Code port forwarding, or any similar
tool to make this reachable from the internet. They work, they are easy, and
they would put Savant's strategic initiative data, owner names, and
leadership decisions on a public URL with no authentication. At a wealth
management firm that is a reportable incident, not a shortcut.

Keep it on the corporate network. If someone outside the office needs to see
it, either get them on the VPN or wait for the Azure deployment, which exists
precisely to solve this properly.

---

## One caution

A laptop running `start:local` is a demo, not a system. The data lives in one
file on one machine that sleeps, reboots, and goes home at night. If two
people start relying on it, export a copy the same day and move the Azure
work forward. Shared tools that live on somebody's laptop have a way of
becoming permanent.
