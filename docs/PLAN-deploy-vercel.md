# Deployment Plan: Hastma Cup 2026 to Vercel

## Goal
Deploy the `hastma-cup-2026` website to Vercel. This includes hosting the static pages (`index.html`, `admin.html`) and enabling the backend API (`api/tournament.js`) using Vercel KV for multi-device data synchronization.

## 1. Project Analysis (Completed)
- **Type**: Static HTML/JS with Serverless API.
- **Dependencies**: Uses `@vercel/kv` for database storage.
- **Status**: Code appears ready for deployment. `package.json` and `vercel.json` are present.

## 2. Prerequisites
You will need:
1.  **GitHub Account**: To store your code. [Sign up here](https://github.com/join).
2.  **Vercel Account**: To host the website. [Sign up here](https://vercel.com/signup).

## 3. Step-by-Step Deployment Guide

### Phase 1: Upload Code to GitHub (Bagi Yang Belum Paham Git)
*Cara termudah tanpa install aplikasi tambahan (Web Upload):*

1.  **Daftar/Login** ke [GitHub.com](https://github.com/login).
2.  Di pojok kanan atas, klik tanda **"+"** lalu pilih **"New repository"**.
3.  **Isi Form:**
    - **Repository name**: `hastma-cup-2026`
    - **Public/Private**: Pilih **Public** (Gratis) atau Private (Bebas).
    - Centang **"Add a README file"** (Penting agar folder tidak kosong).
    - Klik tombol hijau **"Create repository"**.
4.  Setelah jadi, klik tombol **"Add file"** -> **"Upload files"**.
5.  **Buka Folder project Anda** di komputer (E:\Hastma cup 2026\website).
6.  **Drag & Drop (Tarik dan Lepas)** semua file & folder (`css`, `js`, `index.html`, `admin.html`, `package.json`, `vercel.json`, dll) ke area upload di browser.
    - *Tunggu sampai semua progress bar selesai.*
7.  Di bawah (kotak "Commit changes"), ketik "Upload versi pertama".
8.  Klik tombol hijau **"Commit changes"**.
    - *Sekarang kode Anda sudah ada di internet!*

### Phase 2: Connect to Vercel
1.  Log in to your **Vercel Dashboard**.
2.  Click **"Add New..."** -> **"Project"**.
3.  Select **"Continue with GitHub"** and choose the `hastma-cup-2026` repository you just created.
4.  In the "Configure Project" screen:
    - **Framework Preset**: Leave as "Other".
    - **Root Directory**: Leave as `./` (default).
    - Click **Deploy**.

### Phase 3: Connect Database (Critical for Admin Panel)
*Tanpa ini, fitur Admin tidak akan berfungsi (Data tidak akan tersimpan).*

**PENTING:** Saya sudah menulis kode backend (`api/tournament.js`) yang membutuhkan database ini.

1.  Buka **"Storage"** tab di dashboard project Vercel Anda.
2.  Klik **"Create Database"** atau **"Connect Store"**.
3.  Pilih **"Vercel KV"** (Recommended) atau "Upstash Redis".
4.  Klik **"Continue"** / **"Create"**.
5.  **Environment Variables:** Vercel akan otomatis menambahkan variable (`KV_REST_API_URL`, dll) ke project Anda.
    - *Anda tidak perlu setting manual.*
6.  Setelah selesai, kembali ke tab **"Deployments"** di project Anda.
7.  Klik titik tiga (`...`) di deployment paling atas -> pilih **"Redeploy"**.
    - *Ini Penting! Agar website "sadar" bahwa database sudah terpasang.*

### Phase 4: Verification
1.  Open your new Vercel URL (e.g., `https://hastma-cup-2026.vercel.app`).
2.  Go to `https://<your-url>/admin.html`.
3.  Try to **Login** and edit a match score.
4.  Refresh the page. If the score triggers "Live Now" or saved changes, the Database is working!

### Phase 5: Connect Custom Domain (hastmacup.my.id)
1.  Go to your **Project Dashboard** in Vercel.
2.  Click **"Settings"** -> **"Domains"**.
3.  Enter `hastmacup.my.id` in the input box and click **"Add"**.
4.  Vercel will give you "Nameservers" (usually `ns1.vercel-dns.com` and `ns2.vercel-dns.com`).
5.  **Go to your Domain Registrar** (where you bought `hastmacup.my.id`).
6.  Find **"Nameservers"** or **"DNS Management"**.
7.  Change the nameservers to Vercel's nameservers.
    - *Note: It may take up to 24 hours for the domain to work fully.*

## 4. Troubleshooting
- **Admin data lost on refresh?** -> Phase 3 was likely skipped. Check "Storage" tab.
- **"Application Error"?** -> Check Vercel Logs.
