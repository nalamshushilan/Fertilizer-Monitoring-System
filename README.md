# Agricultural Fertilizer & Dealer Management Portal

A full-stack web application designed for agricultural fertilizer monitoring, farmer registration, dealer sales recording, inventory registers, and administrative supervision.

---

## 🏗️ System Architecture

### 1. Form 1: Farmer’s Info (Filled by Dealers/Admins)
- **Farmer’s Name**
- **Address**: Village, Block (1/2/3), Ward, Union, Upazila
- **NID** (Unique) & **Mobile** (Unique)
- **Land Info**:
  - Land Area (in Decimal)
  - Land Type:
    - *Khotian vukto* ➔ Khotian no.
    - *Borga* ➔ Owner Name, Mobile (Unique), NID (Unique), Type of Borga (Regular/irregular)
    - *PF land* ➔ Authority/Owner Name, Mobile (Unique), NID (Unique)
- **Crop Produced**:
  - Paddy (Aus / Aman / Boro)
  - Vegetable
  - Others (with specific crop write-in field)

### 2. Form 2: Dealer’s Sales Info (Filled by Dealers)
- Date of Sale
- Serial no. of register record
- Name of Fertilizer (Urea / TSP / MoP / DAP)
- Quantity (kg) of Fertilizer received / sold
- Link to registered Farmer

### 3. Form 3: Dealer’s Register (Filled by Dealers)
- **Opening Status**: Fertilizer Name (Urea/TSP/MoP/DAP) & Quantity (kg)
- **Closing Status**: Fertilizer Name (Urea/TSP/MoP/DAP) & Quantity (kg)
- Daily balance recording

### 4. Form 4: Dealer Info (Filled by Admins / Superadmins)
- Dealer Name
- Registration Number (Unique)
- Dealer Login Password
- Address: Market name, Union, Upazila
- Manually created by administrators

### 5. Multi-Level Dashboard
- **Geographic Filters**: Ward, Block (1/2/3), Union, Upazila
- **Key Metrics (Real-Time)**:
  - 👨‍🌾 **Number of Farmers received fertilizer**
  - ⚖️ **Quantity (kg) of fertilizer sold**
  - 📦 **Stock status (kg)** across Urea, TSP, MoP, and DAP
- Detailed sales transaction logs and inventory balances.

---

## 🗄️ Supabase Database Setup

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** ➔ **New Query**.
3. Open [`supabase_setup.sql`](./supabase_setup.sql), paste its full contents, and click **Run**.

---

## 🔑 Default Sign In Credentials

- **Dealer Login**:
  - Registration Number: `DLR-001`
  - Password: `dealer123`
- **Admin / Superadmin Login**:
  - Admin Password: `admin123` (or `superadmin`)

---

## 🚀 Running Locally

```powershell
npm run dev
```

Open your browser at: **`http://localhost:5173`**
