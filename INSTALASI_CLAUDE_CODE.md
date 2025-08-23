# 📱 Panduan Instalasi Threads MCP Server di Claude Code

## 🚀 Metode 1: Install dari NPM (Paling Mudah)

### 1. Install package global
```bash
npm install -g threads-mcp-server
```

### 2. Tambahkan ke konfigurasi Claude Code
Edit file konfigurasi Claude Code di `~/.config/claude-code/mcp.json`:

```json
{
  "mcpServers": {
    "threads": {
      "command": "threads-mcp-server",
      "env": {
        "THREADS_ACCESS_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

## 🛠 Metode 2: Install Lokal dari Source

### 1. Clone repository
```bash
git clone https://github.com/baguskto/threads-mcp.git
cd threads-mcp
```

### 2. Install dependencies dan build
```bash
npm install
npm run build
```

### 3. Tambahkan ke konfigurasi Claude Code
```json
{
  "mcpServers": {
    "threads": {
      "command": "node",
      "args": ["/path/ke/threads-mcp/dist/index.js"],
      "env": {
        "THREADS_ACCESS_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

## 🔧 Metode 3: Install via npx (Tidak perlu install global)

```json
{
  "mcpServers": {
    "threads": {
      "command": "npx",
      "args": ["threads-mcp-server"],
      "env": {
        "THREADS_ACCESS_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

## 🔑 Mendapatkan Access Token

1. Pergi ke [Meta for Developers](https://developers.facebook.com/)
2. Buat aplikasi baru atau gunakan yang sudah ada
3. Tambahkan produk "Threads API"
4. Generate access token dengan permissions yang diperlukan
5. Copy token dan masukkan ke konfigurasi

## ✅ Verifikasi Instalasi

1. Restart Claude Code
2. Buka chat baru
3. Coba perintah berikut:

```
@threads get current user profile
```

Jika berhasil, Anda akan melihat profil user yang ter-authenticate.

## 🛠 Tools yang Tersedia

### 1. **get_current_user**
Mendapatkan profil user yang sedang login
```
@threads get current user info
```

### 2. **get_user_profile** 
Mendapatkan profil user berdasarkan ID
```
@threads get user profile for ID 12345
```

### 3. **get_user_threads**
Mendapatkan posts/threads dari user
```
@threads get posts from user 12345 with limit 10
```

### 4. **search_threads**
Mencari threads berdasarkan keyword
```
@threads search for "technology" in recent posts
```

## 🐛 Troubleshooting

### Error "Access token required"
- Pastikan `THREADS_ACCESS_TOKEN` sudah diset dengan benar
- Periksa token masih valid

### Error "Command not found"
- Pastikan package sudah terinstall dengan benar
- Coba install ulang: `npm install -g threads-mcp-server`

### MCP server tidak terhubung
- Restart Claude Code
- Periksa format JSON konfigurasi
- Cek logs di Claude Code untuk error detail

## 📊 Contoh Penggunaan

```
# Mendapatkan profil saat ini
@threads get my profile information

# Mencari threads tentang AI
@threads search for "artificial intelligence" in top posts

# Mendapatkan 20 posts terbaru dari user tertentu
@threads get 20 recent posts from user 24316150841377351

# Mendapatkan detail profil lengkap
@threads get detailed profile for user baguskrnnt
```

## 🔄 Update

Untuk update ke versi terbaru:
```bash
npm update -g threads-mcp-server
```

---

✨ **Server sudah siap digunakan!** Package `threads-mcp-server@1.0.0` sudah tersedia di npm registry.