import { supabase, isSupabaseConfigured, Session } from './supabase.js';

// Global State
let currentUser = Session.get(); // { role: 'dealer'|'admin'|'superadmin', dealer: {...} }
let farmersCache = [];
let dealersCache = [];
let salesCache = [];
let registersCache = [];

// DOM References
const navTabs = document.getElementById('navTabs');
const tabForm1 = document.getElementById('tabForm1');
const tabForm2 = document.getElementById('tabForm2');
const tabForm3 = document.getElementById('tabForm3');
const tabForm4 = document.getElementById('tabForm4');

const userProfileBar = document.getElementById('userProfileBar');
const userRoleBadge = document.getElementById('userRoleBadge');
const userNameDisplay = document.getElementById('userNameDisplay');
const btnLogout = document.getElementById('btnLogout');
const btnLoginNav = document.getElementById('btnLoginNav');
const globalAlert = document.getElementById('globalAlert');
const toast = document.getElementById('toast');

// Views
const views = {
  dashboard: document.getElementById('viewDashboard'),
  form1: document.getElementById('viewForm1'),
  form2: document.getElementById('viewForm2'),
  form3: document.getElementById('viewForm3'),
  form4: document.getElementById('viewForm4'),
  auth: document.getElementById('viewAuth')
};

// UI Toast
function showToast(msg, isSuccess = true) {
  toast.textContent = msg;
  toast.className = `toast show ${isSuccess ? 'toast-success' : 'toast-error'}`;
  setTimeout(() => {
    toast.className = 'toast';
  }, 3200);
}

// UI Alert
function showAlert(msg, type = 'error') {
  if (!msg) {
    globalAlert.classList.add('hidden');
    globalAlert.textContent = '';
    return;
  }
  globalAlert.className = `alert alert-${type}`;
  globalAlert.textContent = msg;
  globalAlert.classList.remove('hidden');
}

// ---------------------------------------------------------------------
// NAVIGATION & ROLE ROUTING
// ---------------------------------------------------------------------
function switchView(viewName) {
  // Check permission gates
  if ((viewName === 'form1' || viewName === 'form2' || viewName === 'form3') && !currentUser) {
    showToast('Please sign in as a dealer to access this form.', false);
    switchView('auth');
    return;
  }

  if (viewName === 'form4' && (!currentUser || currentUser.role === 'dealer')) {
    showToast('Form 4 is restricted to Admins and Superadmins.', false);
    switchView('auth');
    return;
  }

  // Update tab styles
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Hide all views, display active
  Object.keys(views).forEach(key => {
    if (views[key]) {
      views[key].classList.toggle('hidden', key !== viewName);
    }
  });

  // View specific activations
  if (viewName === 'dashboard') {
    loadDashboardData();
  } else if (viewName === 'form2') {
    populateFarmersDropdown();
  } else if (viewName === 'form3') {
    loadDealerRegisterTable();
  } else if (viewName === 'form4') {
    loadDealersTable();
  }
}

function updateAuthUI() {
  if (currentUser) {
    userProfileBar.classList.remove('hidden');
    btnLoginNav.classList.add('hidden');
    
    userRoleBadge.className = `user-role-pill role-${currentUser.role}`;
    userRoleBadge.textContent = currentUser.role;

    if (currentUser.role === 'dealer') {
      userNameDisplay.textContent = `${currentUser.dealer.dealer_name} (${currentUser.dealer.registration_number})`;
      tabForm1.classList.remove('hidden');
      tabForm2.classList.remove('hidden');
      tabForm3.classList.remove('hidden');
      tabForm4.classList.add('hidden'); // Dealers cannot see form 4
    } else {
      userNameDisplay.textContent = currentUser.name || 'System Admin';
      tabForm1.classList.remove('hidden');
      tabForm2.classList.remove('hidden');
      tabForm3.classList.remove('hidden');
      tabForm4.classList.remove('hidden');
    }
  } else {
    userProfileBar.classList.add('hidden');
    btnLoginNav.classList.remove('hidden');
    tabForm4.classList.add('hidden');
  }
}

// ---------------------------------------------------------------------
// AUTHENTICATION CONTROLLER
// ---------------------------------------------------------------------
const loginForm = document.getElementById('loginForm');
const dealerLoginFields = document.getElementById('dealerLoginFields');
const adminLoginFields = document.getElementById('adminLoginFields');
const loginRegNo = document.getElementById('loginRegNo');
const loginDealerPass = document.getElementById('loginDealerPass');
const adminKeyInput = document.getElementById('adminKeyInput');

document.querySelectorAll('input[name="loginRole"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.value === 'dealer') {
      dealerLoginFields.classList.remove('hidden');
      adminLoginFields.classList.add('hidden');
    } else {
      dealerLoginFields.classList.add('hidden');
      adminLoginFields.classList.remove('hidden');
    }
  });
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showAlert(null);

  const role = document.querySelector('input[name="loginRole"]:checked').value;

  if (role === 'dealer') {
    const regNo = loginRegNo.value.trim();
    const pass = loginDealerPass.value;

    if (!regNo || !pass) {
      showAlert('Please enter both Registration Number and Password.');
      return;
    }

    if (!isSupabaseConfigured) {
      // Mock fallback if offline
      currentUser = {
        role: 'dealer',
        dealer: { id: 'demo-1', registration_number: regNo, dealer_name: 'Demo Dealer Enterprise', upazila: 'Sadar', union_name: 'Sonapur' }
      };
      Session.set(currentUser);
      updateAuthUI();
      showToast(`Welcome back, ${currentUser.dealer.dealer_name}!`);
      switchView('form1');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('dealers')
        .select('*')
        .eq('registration_number', regNo)
        .eq('password', pass)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        showAlert('Invalid Registration Number or Password. Please contact Admin.');
        return;
      }

      currentUser = { role: 'dealer', dealer: data };
      Session.set(currentUser);
      updateAuthUI();
      showToast(`Welcome back, ${data.dealer_name}!`);
      switchView('form1');
    } catch (err) {
      showAlert('Login error: ' + err.message);
    }
  } else {
    // Admin login
    const key = adminKeyInput.value.trim();
    if (!key) {
      showAlert('Please enter the Admin Key.');
      return;
    }

    // Default admin password or superadmin check
    if (key === 'admin123' || key === 'superadmin') {
      currentUser = {
        role: key === 'superadmin' ? 'superadmin' : 'admin',
        name: key === 'superadmin' ? 'Superadmin' : 'Agricultural Admin'
      };
      Session.set(currentUser);
      updateAuthUI();
      showToast('Logged in as Admin.');
      switchView('form4');
    } else {
      showAlert('Incorrect Admin Key.');
    }
  }
});

btnLogout.addEventListener('click', () => {
  Session.clear();
  currentUser = null;
  updateAuthUI();
  showToast('Signed out successfully.');
  switchView('dashboard');
});

btnLoginNav.addEventListener('click', () => {
  switchView('auth');
});

navTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-btn[data-view]');
  if (btn) {
    switchView(btn.dataset.view);
  }
});

// ---------------------------------------------------------------------
// FORM 1: FARMER'S INFO CONTROLLER
// ---------------------------------------------------------------------
const formFarmer = document.getElementById('formFarmer');
const sectionKhotian = document.getElementById('sectionKhotian');
const sectionBorga = document.getElementById('sectionBorga');
const sectionPF = document.getElementById('sectionPF');
const sectionOtherCrop = document.getElementById('sectionOtherCrop');

// Conditional Land Type radio toggle
document.querySelectorAll('input[name="land_type"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const val = e.target.value;
    sectionKhotian.classList.toggle('hidden', val !== 'Khotian vukto');
    sectionBorga.classList.toggle('hidden', val !== 'Borga');
    sectionPF.classList.toggle('hidden', val !== 'PF land');
  });
});

// Conditional Crop Type radio toggle
document.querySelectorAll('input[name="crop_type"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    sectionOtherCrop.classList.toggle('hidden', e.target.value !== 'Others');
  });
});

formFarmer.addEventListener('submit', async (e) => {
  e.preventDefault();
  showAlert(null);

  const landType = document.querySelector('input[name="land_type"]:checked').value;
  const cropType = document.querySelector('input[name="crop_type"]:checked').value;

  const farmerPayload = {
    dealer_id: currentUser?.dealer?.id || null,
    farmer_name: document.getElementById('f_name').value.trim(),
    village: document.getElementById('f_village').value.trim(),
    block: document.getElementById('f_block').value,
    ward: document.getElementById('f_ward').value.trim(),
    union_name: document.getElementById('f_union').value.trim(),
    upazila: document.getElementById('f_upazila').value.trim(),
    nid: document.getElementById('f_nid').value.trim(),
    mobile: document.getElementById('f_mobile').value.trim(),
    land_area: parseFloat(document.getElementById('f_land_area').value),
    land_type: landType,
    khotian_no: landType === 'Khotian vukto' ? document.getElementById('f_khotian_no').value.trim() : null,
    borga_owner_name: landType === 'Borga' ? document.getElementById('f_borga_name').value.trim() : null,
    borga_owner_mobile: landType === 'Borga' ? document.getElementById('f_borga_mobile').value.trim() : null,
    borga_owner_nid: landType === 'Borga' ? document.getElementById('f_borga_nid').value.trim() : null,
    borga_type: landType === 'Borga' ? document.getElementById('f_borga_type').value : null,
    pf_owner_name: landType === 'PF land' ? document.getElementById('f_pf_name').value.trim() : null,
    pf_owner_mobile: landType === 'PF land' ? document.getElementById('f_pf_mobile').value.trim() : null,
    pf_owner_nid: landType === 'PF land' ? document.getElementById('f_pf_nid').value.trim() : null,
    crop_type: cropType,
    crop_other_details: cropType === 'Others' ? document.getElementById('f_other_crop').value.trim() : null
  };

  if (!isSupabaseConfigured) {
    farmersCache.push({ id: 'f-' + Date.now(), ...farmerPayload });
    showToast(`Farmer ${farmerPayload.farmer_name} registered successfully (Demo Mode)!`);
    formFarmer.reset();
    return;
  }

  try {
    const { data, error } = await supabase.from('farmers').insert([farmerPayload]).select().single();
    if (error) {
      if (error.message.includes('nid')) throw new Error('Farmer with this NID already exists.');
      if (error.message.includes('mobile')) throw new Error('Farmer with this Mobile number already exists.');
      throw error;
    }

    showToast(`Farmer ${data.farmer_name} registered successfully!`);
    formFarmer.reset();
  } catch (err) {
    showAlert('Error saving Farmer info: ' + err.message);
  }
});

// ---------------------------------------------------------------------
// FORM 2: DEALER'S SALES INFO CONTROLLER
// ---------------------------------------------------------------------
const formSales = document.getElementById('formSales');
const s_farmer_id = document.getElementById('s_farmer_id');

async function populateFarmersDropdown() {
  s_farmer_id.innerHTML = '<option value="">-- Choose Registered Farmer (Search by NID/Name) --</option>';

  if (!isSupabaseConfigured) {
    farmersCache.forEach(f => {
      s_farmer_id.innerHTML += `<option value="${f.id}">${f.farmer_name} (NID: ${f.nid} • Mobile: ${f.mobile})</option>`;
    });
    return;
  }

  try {
    const { data, error } = await supabase.from('farmers').select('id, farmer_name, nid, mobile, village, union_name');
    if (error) throw error;

    farmersCache = data || [];
    farmersCache.forEach(f => {
      s_farmer_id.innerHTML += `<option value="${f.id}">${f.farmer_name} (NID: ${f.nid} • ${f.village}, ${f.union_name})</option>`;
    });
  } catch (err) {
    console.warn('Error loading farmers dropdown:', err);
  }
}

formSales.addEventListener('submit', async (e) => {
  e.preventDefault();
  showAlert(null);

  if (!currentUser?.dealer && currentUser?.role !== 'admin' && currentUser?.role !== 'superadmin') {
    showAlert('Please log in as a dealer to record sales.');
    return;
  }

  const salesPayload = {
    dealer_id: currentUser?.dealer?.id || dealersCache[0]?.id || null,
    farmer_id: s_farmer_id.value,
    sale_date: document.getElementById('s_date').value,
    register_serial_no: document.getElementById('s_serial').value.trim(),
    fertilizer_name: document.getElementById('s_fertilizer').value,
    quantity_kg: parseFloat(document.getElementById('s_quantity').value)
  };

  if (!isSupabaseConfigured) {
    salesCache.push({ id: 's-' + Date.now(), ...salesPayload });
    showToast(`Recorded sale of ${salesPayload.quantity_kg}kg ${salesPayload.fertilizer_name}!`);
    formSales.reset();
    return;
  }

  try {
    const { error } = await supabase.from('dealer_sales').insert([salesPayload]);
    if (error) throw error;

    showToast(`Recorded sale of ${salesPayload.quantity_kg}kg ${salesPayload.fertilizer_name}!`);
    formSales.reset();
    document.getElementById('s_date').valueAsDate = new Date();
  } catch (err) {
    showAlert('Error saving sales info: ' + err.message);
  }
});

// Set default sale date today
document.getElementById('s_date').valueAsDate = new Date();
document.getElementById('r_date').valueAsDate = new Date();

// ---------------------------------------------------------------------
// FORM 3: DEALER'S REGISTER CONTROLLER
// ---------------------------------------------------------------------
const formRegister = document.getElementById('formRegister');
const dealerRegisterTableBody = document.getElementById('dealerRegisterTableBody');

async function loadDealerRegisterTable() {
  dealerRegisterTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:18px;">Loading register...</td></tr>`;

  if (!isSupabaseConfigured) {
    renderRegisterTable(registersCache);
    return;
  }

  try {
    let query = supabase.from('dealer_registers').select('*').order('created_at', { ascending: false });
    if (currentUser?.dealer?.id) {
      query = query.eq('dealer_id', currentUser.dealer.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    renderRegisterTable(data || []);
  } catch (err) {
    dealerRegisterTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#f87171;">Failed to load register records.</td></tr>`;
  }
}

function renderRegisterTable(items) {
  if (items.length === 0) {
    dealerRegisterTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:18px; color:var(--text-muted);">No register entries yet.</td></tr>`;
    return;
  }

  dealerRegisterTableBody.innerHTML = items.map(item => `
    <tr>
      <td>${item.record_date}</td>
      <td><span class="user-role-pill" style="background:${item.status_type === 'Opening' ? '#3b82f6' : '#8b5cf6'}">${item.status_type} Status</span></td>
      <td><strong>${item.fertilizer_name}</strong></td>
      <td><strong>${item.quantity_kg}</strong> kg</td>
    </tr>
  `).join('');
}

formRegister.addEventListener('submit', async (e) => {
  e.preventDefault();
  showAlert(null);

  const regPayload = {
    dealer_id: currentUser?.dealer?.id || dealersCache[0]?.id || null,
    record_date: document.getElementById('r_date').value,
    status_type: document.getElementById('r_status_type').value,
    fertilizer_name: document.getElementById('r_fertilizer').value,
    quantity_kg: parseFloat(document.getElementById('r_quantity').value)
  };

  if (!isSupabaseConfigured) {
    registersCache.unshift({ id: 'r-' + Date.now(), ...regPayload });
    showToast(`Saved ${regPayload.status_type} status of ${regPayload.quantity_kg}kg ${regPayload.fertilizer_name}!`);
    formRegister.reset();
    document.getElementById('r_date').valueAsDate = new Date();
    loadDealerRegisterTable();
    return;
  }

  try {
    const { error } = await supabase.from('dealer_registers').insert([regPayload]);
    if (error) throw error;

    showToast(`Saved ${regPayload.status_type} status of ${regPayload.quantity_kg}kg ${regPayload.fertilizer_name}!`);
    formRegister.reset();
    document.getElementById('r_date').valueAsDate = new Date();
    loadDealerRegisterTable();
  } catch (err) {
    showAlert('Error saving register: ' + err.message);
  }
});

// ---------------------------------------------------------------------
// FORM 4: DEALER INFO (ADMIN REGISTRATION) CONTROLLER
// ---------------------------------------------------------------------
const formDealer = document.getElementById('formDealer');
const allDealersTableBody = document.getElementById('allDealersTableBody');

async function loadDealersTable() {
  allDealersTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:18px;">Loading dealers...</td></tr>`;

  if (!isSupabaseConfigured) {
    renderDealersTable(dealersCache);
    return;
  }

  try {
    const { data, error } = await supabase.from('dealers').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    dealersCache = data || [];
    renderDealersTable(dealersCache);
  } catch (err) {
    allDealersTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#f87171;">Failed to load dealers.</td></tr>`;
  }
}

function renderDealersTable(dealers) {
  if (dealers.length === 0) {
    allDealersTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:18px; color:var(--text-muted);">No dealers registered yet.</td></tr>`;
    return;
  }

  allDealersTableBody.innerHTML = dealers.map(d => `
    <tr>
      <td><code>${d.registration_number}</code></td>
      <td><strong>${d.dealer_name}</strong></td>
      <td><code>${d.password}</code></td>
      <td>${d.market_name}</td>
      <td>${d.union_name}, ${d.upazila}</td>
      <td style="color:var(--text-muted); font-size:0.8rem;">${new Date(d.created_at).toLocaleDateString()}</td>
    </tr>
  `).join('');
}

formDealer.addEventListener('submit', async (e) => {
  e.preventDefault();
  showAlert(null);

  const dealerPayload = {
    dealer_name: document.getElementById('d_name').value.trim(),
    registration_number: document.getElementById('d_reg_no').value.trim(),
    password: document.getElementById('d_password').value.trim(),
    market_name: document.getElementById('d_market').value.trim(),
    union_name: document.getElementById('d_union').value.trim(),
    upazila: document.getElementById('d_upazila').value.trim()
  };

  if (!isSupabaseConfigured) {
    dealersCache.unshift({ id: 'd-' + Date.now(), created_at: new Date().toISOString(), ...dealerPayload });
    showToast(`Dealer ${dealerPayload.dealer_name} registered!`);
    formDealer.reset();
    loadDealersTable();
    return;
  }

  try {
    const { data, error } = await supabase.from('dealers').insert([dealerPayload]).select().single();
    if (error) {
      if (error.message.includes('registration_number')) throw new Error('A dealer with this Registration Number already exists.');
      throw error;
    }

    showToast(`Dealer ${data.dealer_name} (Reg: ${data.registration_number}) registered!`);
    formDealer.reset();
    loadDealersTable();
  } catch (err) {
    showAlert('Error saving dealer: ' + err.message);
  }
});

// ---------------------------------------------------------------------
// DASHBOARD: WARD / BLOCK / UNION / UPAZILA FILTERS & METRICS
// ---------------------------------------------------------------------
const filterUpazila = document.getElementById('filterUpazila');
const filterUnion = document.getElementById('filterUnion');
const filterBlock = document.getElementById('filterBlock');
const filterWard = document.getElementById('filterWard');
const filterStartDate = document.getElementById('filterStartDate');
const filterEndDate = document.getElementById('filterEndDate');
const btnResetFilters = document.getElementById('btnResetFilters');
const btnRefreshDashboard = document.getElementById('btnRefreshDashboard');

const metricFarmerCount = document.getElementById('metricFarmerCount');
const metricSoldKg = document.getElementById('metricSoldKg');
const metricStockKg = document.getElementById('metricStockKg');
const fertilizerStatsBody = document.getElementById('fertilizerStatsBody');
const recentSalesTableBody = document.getElementById('recentSalesTableBody');
const registeredFarmersTableBody = document.getElementById('registeredFarmersTableBody');
const searchFarmerInput = document.getElementById('searchFarmerInput');
const farmerBadgeCount = document.getElementById('farmerBadgeCount');

// Summary Report Elements
const summaryGroupBy = document.getElementById('summaryGroupBy');
const summaryTableBody = document.getElementById('summaryTableBody');
const summaryTableFoot = document.getElementById('summaryTableFoot');
const thGrouping = document.getElementById('thGrouping');
const btnExportExcel = document.getElementById('btnExportExcel');
const btnExportPDF = document.getElementById('btnExportPDF');
const btnPrintSummary = document.getElementById('btnPrintSummary');

// Active summary report cache for exporting
let currentSummaryData = [];
let currentFilteredSalesData = [];
let currentFilteredFarmersData = [];

// Recent Sales Export Elements
const btnExportSalesExcel = document.getElementById('btnExportSalesExcel');
const btnExportSalesPDF = document.getElementById('btnExportSalesPDF');

// Registered Farmers Export Elements
const btnExportFarmersExcel = document.getElementById('btnExportFarmersExcel');
const btnExportFarmersPDF = document.getElementById('btnExportFarmersPDF');

async function loadDashboardData() {
  if (!isSupabaseConfigured) {
    computeAndRenderDashboard();
    return;
  }

  try {
    // Parallel fetch of all related data
    const [farmersRes, salesRes, registersRes, dealersRes] = await Promise.all([
      supabase.from('farmers').select('*'),
      supabase.from('dealer_sales').select('*, farmers(*)'),
      supabase.from('dealer_registers').select('*'),
      supabase.from('dealers').select('*')
    ]);

    farmersCache = farmersRes.data || [];
    salesCache = salesRes.data || [];
    registersCache = registersRes.data || [];
    dealersCache = dealersRes.data || [];

    populateFilterOptions();
    computeAndRenderDashboard();
  } catch (err) {
    console.error('Error loading dashboard:', err);
    showToast('Failed to refresh dashboard data: ' + err.message, false);
  }
}

// Geographic Master Data
const COX_BAZAR_UPAZILAS = [
  "Ukhiya",
  "Cox's Bazar Sadar",
  "Teknaf",
  "Ramu",
  "Chakaria",
  "Moheshkhali",
  "Kutubdia",
  "Pekua",
  "Eidgaon"
];

const UKHIYA_UNIONS = [
  "Raja Palong",
  "Jalia Palong",
  "Palong Khali",
  "Ratna Palong",
  "Holdia Palong"
];

function populateFilterOptions() {
  const upazilas = new Set(COX_BAZAR_UPAZILAS);
  const unions = new Set(UKHIYA_UNIONS);

  // Also include any extra locations found in stored database records
  farmersCache.forEach(f => {
    if (f.upazila) upazilas.add(f.upazila);
    if (f.union_name) unions.add(f.union_name);
  });
  dealersCache.forEach(d => {
    if (d.upazila) upazilas.add(d.upazila);
    if (d.union_name) unions.add(d.union_name);
  });

  const selectedUpazila = filterUpazila.value;
  const selectedUnion = filterUnion.value;

  filterUpazila.innerHTML = '<option value="">All Upazilas (Cox\'s Bazar)</option>' + 
    Array.from(upazilas).map(u => `<option value="${u}" ${u === selectedUpazila ? 'selected' : ''}>${u}</option>`).join('');

  filterUnion.innerHTML = '<option value="">All Unions (Ukhiya)</option>' + 
    Array.from(unions).map(u => `<option value="${u}" ${u === selectedUnion ? 'selected' : ''}>${u}</option>`).join('');
}

function computeAndRenderDashboard() {
  const upazilaVal = filterUpazila.value.toLowerCase().trim();
  const unionVal = filterUnion.value.toLowerCase().trim();
  const blockVal = filterBlock.value.trim();
  const wardVal = filterWard.value.toLowerCase().trim();

  const startDateVal = filterStartDate?.value || '';
  const endDateVal = filterEndDate?.value || '';

  // 1. Filter Farmers by geographic selection
  const matchingFarmers = farmersCache.filter(f => {
    if (upazilaVal && (f.upazila || '').toLowerCase() !== upazilaVal) return false;
    if (unionVal && (f.union_name || '').toLowerCase() !== unionVal) return false;
    if (blockVal && String(f.block) !== blockVal) return false;
    if (wardVal && !(f.ward || '').toLowerCase().includes(wardVal)) return false;
    return true;
  });

  const matchingFarmerIds = new Set(matchingFarmers.map(f => f.id));

  // 2. Filter Sales to matching farmers and date range
  const filteredSales = salesCache.filter(s => {
    // If geo filter is applied, farmer must match
    if (upazilaVal || unionVal || blockVal || wardVal) {
      if (!matchingFarmerIds.has(s.farmer_id)) return false;
    }
    // Date filter
    if (startDateVal && s.sale_date < startDateVal) return false;
    if (endDateVal && s.sale_date > endDateVal) return false;
    return true;
  });

  // KPI 1: Number of Farmer received fertilizer
  const farmersReceivedSet = new Set(filteredSales.map(s => s.farmer_id).filter(Boolean));
  metricFarmerCount.textContent = farmersReceivedSet.size;

  // KPI 2: Quantity (kg) of fertilizer sold
  const totalSoldKg = filteredSales.reduce((sum, s) => sum + (parseFloat(s.quantity_kg) || 0), 0);
  metricSoldKg.innerHTML = `${totalSoldKg.toLocaleString()} <span style="font-size: 1.1rem; font-weight: 500;">kg</span>`;

  // 3. Compute Stock Status (Opening - Sold or Latest Register)
  const fertilizerTypes = ['Urea', 'TSP', 'MoP', 'DAP'];
  const breakdown = {};

  fertilizerTypes.forEach(ft => {
    breakdown[ft] = { sold: 0, opening: 0, closing: 0 };
  });

  // Calculate sold per fertilizer
  filteredSales.forEach(s => {
    if (breakdown[s.fertilizer_name]) {
      breakdown[s.fertilizer_name].sold += parseFloat(s.quantity_kg) || 0;
    }
  });

  // Calculate registered stock
  registersCache.forEach(r => {
    if (breakdown[r.fertilizer_name]) {
      if (r.status_type === 'Opening') {
        breakdown[r.fertilizer_name].opening += parseFloat(r.quantity_kg) || 0;
      } else if (r.status_type === 'Closing') {
        breakdown[r.fertilizer_name].closing += parseFloat(r.quantity_kg) || 0;
      }
    }
  });

  // Total Stock KPI (Sum of Closing stocks, or Opening - Sold)
  let totalStockKg = 0;
  fertilizerTypes.forEach(ft => {
    const item = breakdown[ft];
    const available = item.closing > 0 ? item.closing : Math.max(0, item.opening - item.sold);
    totalStockKg += available;
  });

  metricStockKg.innerHTML = `${totalStockKg.toLocaleString()} <span style="font-size: 1.1rem; font-weight: 500;">kg</span>`;

  // Render Fertilizer Breakdown Table
  fertilizerStatsBody.innerHTML = fertilizerTypes.map(ft => {
    const item = breakdown[ft];
    const balance = item.closing > 0 ? item.closing : (item.opening - item.sold);
    return `
      <tr>
        <td><strong>${ft}</strong></td>
        <td><span style="color:#10b981; font-weight:600;">${item.sold.toLocaleString()}</span> kg</td>
        <td>${item.opening.toLocaleString()} kg</td>
        <td>${item.closing.toLocaleString()} kg</td>
        <td><strong style="color:${balance >= 0 ? '#60a5fa' : '#f87171'};">${balance.toLocaleString()} kg</strong></td>
      </tr>
    `;
  }).join('');

  // Render Recent Sales Table & Cache for export
  currentFilteredSalesData = filteredSales.map(s => {
    const farmerObj = s.farmers || farmersCache.find(f => f.id === s.farmer_id);
    return {
      date: s.sale_date,
      serial: s.register_serial_no,
      farmerName: farmerObj?.farmer_name || 'Registered Farmer',
      farmerLocation: farmerObj ? `${farmerObj.village}, Ward ${farmerObj.ward}, Block ${farmerObj.block}, ${farmerObj.union_name}` : 'N/A',
      fertilizer: s.fertilizer_name,
      quantityKg: parseFloat(s.quantity_kg) || 0
    };
  });

  if (filteredSales.length === 0) {
    recentSalesTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">No sales records found matching the filter.</td></tr>`;
  } else {
    recentSalesTableBody.innerHTML = filteredSales.slice(0, 25).map(s => {
      const farmerObj = s.farmers || farmersCache.find(f => f.id === s.farmer_id);
      const farmerName = farmerObj?.farmer_name || 'Registered Farmer';
      const farmerLoc = farmerObj ? `${farmerObj.village}, Ward ${farmerObj.ward}` : 'N/A';

      return `
        <tr>
          <td>${s.sale_date}</td>
          <td><code>${s.register_serial_no}</code></td>
          <td><strong>${farmerName}</strong></td>
          <td style="color:var(--text-muted); font-size:0.82rem;">${farmerLoc}</td>
          <td><span class="user-role-pill" style="background:#047857;">${s.fertilizer_name}</span></td>
          <td><strong>${s.quantity_kg}</strong> kg</td>
        </tr>
      `;
    }).join('');
  }

  // 4. Render Registered Farmers Directory & Cache for export
  const searchQuery = (searchFarmerInput?.value || '').toLowerCase().trim();
  const searchFilteredFarmers = matchingFarmers.filter(f => {
    if (!searchQuery) return true;
    return (
      (f.farmer_name || '').toLowerCase().includes(searchQuery) ||
      (f.nid || '').toLowerCase().includes(searchQuery) ||
      (f.mobile || '').toLowerCase().includes(searchQuery) ||
      (f.village || '').toLowerCase().includes(searchQuery)
    );
  });

  currentFilteredFarmersData = searchFilteredFarmers;

  if (farmerBadgeCount) {
    farmerBadgeCount.textContent = `${searchFilteredFarmers.length} Farmer${searchFilteredFarmers.length === 1 ? '' : 's'}`;
  }

  if (!registeredFarmersTableBody) return;

  if (searchFilteredFarmers.length === 0) {
    registeredFarmersTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">
          No registered farmers found matching the active filter or search.
        </td>
      </tr>
    `;
  } else {
    registeredFarmersTableBody.innerHTML = searchFilteredFarmers.map(f => {
      // Land specifics display
      let landDetails = `<strong>${f.land_area} dec</strong> (${f.land_type})`;
      if (f.land_type === 'Khotian vukto' && f.khotian_no) {
        landDetails += `<div style="font-size:0.78rem; color:var(--text-muted);">Khotian: ${f.khotian_no}</div>`;
      } else if (f.land_type === 'Borga') {
        landDetails += `<div style="font-size:0.78rem; color:var(--text-muted);">${f.borga_type || ''} • Owner: ${f.borga_owner_name || 'N/A'} (${f.borga_owner_mobile || ''})</div>`;
      } else if (f.land_type === 'PF land') {
        landDetails += `<div style="font-size:0.78rem; color:var(--text-muted);">PF Owner: ${f.pf_owner_name || 'N/A'} (${f.pf_owner_mobile || ''})</div>`;
      }

      // Crop specifics display
      let cropDisplay = `<span class="user-role-pill" style="background:#065f46;">${f.crop_type}</span>`;
      if (f.crop_type === 'Others' && f.crop_other_details) {
        cropDisplay += `<div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">${f.crop_other_details}</div>`;
      }

      return `
        <tr>
          <td>
            <strong>${f.farmer_name}</strong>
          </td>
          <td><a href="tel:${f.mobile}" style="color:#60a5fa; text-decoration:none;">${f.mobile}</a></td>
          <td><code>${f.nid}</code></td>
          <td style="font-size:0.85rem;">
            ${f.village}, Ward ${f.ward}, Block ${f.block}<br/>
            <span style="color:var(--text-muted);">${f.union_name}, ${f.upazila}</span>
          </td>
          <td>${landDetails}</td>
          <td>${cropDisplay}</td>
        </tr>
      `;
    }).join('');
  }

  // 5. Render Union, Block, Ward & Date-wise Summary Report
  renderSummaryReport(filteredSales, matchingFarmers);
}

// ---------------------------------------------------------------------
// SUMMARY REPORT BUILDER & EXPORTERS (Union, Block, Ward, Date-wise)
// ---------------------------------------------------------------------
function renderSummaryReport(filteredSales, matchingFarmers) {
  if (!summaryTableBody) return;

  const groupMode = summaryGroupBy?.value || 'detailed';

  // Build farmer map for fast lookups
  const farmerMap = new Map();
  farmersCache.forEach(f => farmerMap.set(f.id, f));

  // Build dealer map
  const dealerMap = new Map();
  dealersCache.forEach(d => dealerMap.set(d.id, d));

  // Calculate stock balance per dealer from registers and sales
  // dealerStockMap: dealerId => { opening: kg, closing: kg, sold: kg, balance: kg }
  const dealerStockMap = new Map();
  dealersCache.forEach(d => {
    dealerStockMap.set(d.id, { opening: 0, closing: 0, sold: 0 });
  });

  registersCache.forEach(r => {
    const entry = dealerStockMap.get(r.dealer_id);
    if (entry) {
      const kg = parseFloat(r.quantity_kg) || 0;
      if (r.status_type === 'Opening') entry.opening += kg;
      else if (r.status_type === 'Closing') entry.closing += kg;
    }
  });

  salesCache.forEach(s => {
    const entry = dealerStockMap.get(s.dealer_id);
    if (entry) {
      entry.sold += parseFloat(s.quantity_kg) || 0;
    }
  });

  // Aggregation bucket
  // key => { groupLabel, union, block, ward, date, farmersSet: Set, soldKg, dealersSet: Set }
  const groups = new Map();

  filteredSales.forEach(s => {
    const farmer = s.farmers || farmerMap.get(s.farmer_id) || {};
    const u = farmer.union_name || 'Unknown Union';
    const b = farmer.block ? `Block ${farmer.block}` : 'N/A';
    const w = farmer.ward ? `Ward ${farmer.ward}` : 'N/A';
    const d = s.sale_date || 'N/A';

    let groupKey = '';
    let groupLabel = '';

    if (groupMode === 'union') {
      groupKey = u;
      groupLabel = u;
    } else if (groupMode === 'block') {
      groupKey = `${u} - ${b}`;
      groupLabel = `${u} (${b})`;
    } else if (groupMode === 'ward') {
      groupKey = `${u} - ${b} - ${w}`;
      groupLabel = `${u} • ${w}`;
    } else if (groupMode === 'date') {
      groupKey = d;
      groupLabel = `Date: ${d}`;
    } else {
      // Detailed: Union + Block + Ward + Date
      groupKey = `${u}_${b}_${w}_${d}`;
      groupLabel = `${u} | ${b} | ${w} | ${d}`;
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        groupLabel,
        union: u,
        block: b,
        ward: w,
        date: d,
        farmersSet: new Set(),
        soldKg: 0,
        dealersSet: new Set(),
      });
    }

    const row = groups.get(groupKey);
    if (s.farmer_id) row.farmersSet.add(s.farmer_id);
    row.soldKg += parseFloat(s.quantity_kg) || 0;
    if (s.dealer_id) row.dealersSet.add(s.dealer_id);
  });

  // Transform to structured array
  currentSummaryData = Array.from(groups.values()).map(g => {
    // Stock calculation for this bucket
    let openingStock = 0;
    let closingStock = 0;
    let soldAcrossDealers = 0;

    g.dealersSet.forEach(dId => {
      const dStock = dealerStockMap.get(dId);
      if (dStock) {
        openingStock += dStock.opening;
        closingStock += dStock.closing;
        soldAcrossDealers += dStock.sold;
      }
    });

    const currentBalance = closingStock > 0 ? closingStock : Math.max(0, openingStock - soldAcrossDealers);

    return {
      groupLabel: g.groupLabel,
      date: g.date,
      union: g.union,
      block: g.block,
      ward: g.ward,
      farmerCount: g.farmersSet.size,
      soldKg: g.soldKg,
      openingStock,
      closingStock,
      stockBalance: currentBalance
    };
  });

  // Sort by date descending or label
  currentSummaryData.sort((a, b) => (b.date > a.date ? 1 : -1));

  // Render Table
  if (currentSummaryData.length === 0) {
    summaryTableBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 24px;">
          No sales or distribution summary found for this filter.
        </td>
      </tr>
    `;
    summaryTableFoot.innerHTML = '';
    return;
  }

  let totalFarmers = 0;
  let totalSold = 0;
  let totalOpening = 0;
  let totalClosing = 0;
  let totalBalance = 0;

  summaryTableBody.innerHTML = currentSummaryData.map(row => {
    totalFarmers += row.farmerCount;
    totalSold += row.soldKg;
    totalOpening += row.openingStock;
    totalClosing += row.closingStock;
    totalBalance += row.stockBalance;

    return `
      <tr>
        <td><strong>${row.groupLabel}</strong></td>
        <td><code>${row.date}</code></td>
        <td>${row.union}</td>
        <td>${row.block}</td>
        <td>${row.ward}</td>
        <td style="text-align: right;"><span class="user-role-pill" style="background:#2563eb;">${row.farmerCount}</span></td>
        <td style="text-align: right; color:#10b981; font-weight:700;">${row.soldKg.toLocaleString()} kg</td>
        <td style="text-align: right;">${row.openingStock.toLocaleString()} kg</td>
        <td style="text-align: right;">${row.closingStock.toLocaleString()} kg</td>
        <td style="text-align: right; font-weight:700; color:#60a5fa;">${row.stockBalance.toLocaleString()} kg</td>
      </tr>
    `;
  }).join('');

  // Table Footer Totals
  summaryTableFoot.innerHTML = `
    <tr>
      <td colspan="5" style="padding: 12px 14px;"><strong>OVERALL SUMMARY TOTALS</strong></td>
      <td style="text-align: right;"><span class="user-role-pill" style="background:#1d4ed8;">${totalFarmers}</span></td>
      <td style="text-align: right; color:#10b981; font-size:1.05rem;">${totalSold.toLocaleString()} kg</td>
      <td style="text-align: right;">${totalOpening.toLocaleString()} kg</td>
      <td style="text-align: right;">${totalClosing.toLocaleString()} kg</td>
      <td style="text-align: right; color:#60a5fa; font-size:1.05rem;">${totalBalance.toLocaleString()} kg</td>
    </tr>
  `;
}

// ---------------------------------------------------------------------
// EXPORT HANDLERS: EXCEL, PDF & PRINT
// ---------------------------------------------------------------------
function exportToExcel() {
  if (!currentSummaryData || currentSummaryData.length === 0) {
    showToast('No summary data to export.', false);
    return;
  }

  const XLSXLib = window.XLSX;
  if (!XLSXLib) {
    showToast('Excel exporter library is loading, please try again.', false);
    return;
  }

  try {
    const exportRows = currentSummaryData.map((r, i) => ({
      'SL': i + 1,
      'Group': r.groupLabel,
      'Date': r.date,
      'Union': r.union,
      'Block': r.block,
      'Ward': r.ward,
      'Farmers Received': r.farmerCount,
      'Fertilizer Sold (kg)': r.soldKg,
      'Opening Stock (kg)': r.openingStock,
      'Closing Stock (kg)': r.closingStock,
      'Stock Balance (kg)': r.stockBalance
    }));

    const worksheet = XLSXLib.utils.json_to_sheet(exportRows);
    const workbook = XLSXLib.utils.book_new();
    XLSXLib.utils.book_append_sheet(workbook, worksheet, 'Summary Report');

    const fileName = `Fertilizer_Summary_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSXLib.writeFile(workbook, fileName);
    showToast('Excel report downloaded successfully!');
  } catch (err) {
    console.error('Excel Export Error:', err);
    showToast('Failed to export Excel: ' + err.message, false);
  }
}

function exportToPDF() {
  if (!currentSummaryData || currentSummaryData.length === 0) {
    showToast('No summary data to export.', false);
    return;
  }

  const jsPDFConstructor = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFConstructor) {
    showToast('PDF exporter library is loading, please try again.', false);
    return;
  }

  try {
    const doc = new jsPDFConstructor('landscape');

    // Title & Header info
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('Agricultural Fertilizer Distribution Summary Report', 14, 15);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    const filterInfo = `Filters: Upazila: ${filterUpazila.value || 'All'} | Union: ${filterUnion.value || 'All'} | Block: ${filterBlock.value || 'All'} | Ward: ${filterWard.value || 'All'} | Generated: ${new Date().toLocaleDateString()}`;
    doc.text(filterInfo, 14, 22);

    const headers = [
      ['SL', 'Group', 'Date', 'Union', 'Block', 'Ward', 'Farmers', 'Sold (kg)', 'Opening (kg)', 'Closing (kg)', 'Balance (kg)']
    ];

    const body = currentSummaryData.map((r, i) => [
      i + 1,
      r.groupLabel,
      r.date,
      r.union,
      r.block,
      r.ward,
      r.farmerCount,
      r.soldKg.toLocaleString(),
      r.openingStock.toLocaleString(),
      r.closingStock.toLocaleString(),
      r.stockBalance.toLocaleString()
    ]);

    doc.autoTable({
      head: headers,
      body: body,
      startY: 26,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right' }
      }
    });

    const fileName = `Fertilizer_Summary_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    showToast('PDF report downloaded successfully!');
  } catch (err) {
    console.error('PDF Export Error:', err);
    showToast('Failed to export PDF: ' + err.message, false);
  }
}

function printSummaryReport() {
  window.print();
}

// ---------------------------------------------------------------------
// EXPORT HANDLERS: RECENT SALES RECORDS
// ---------------------------------------------------------------------
function exportSalesToExcel() {
  if (!currentFilteredSalesData || currentFilteredSalesData.length === 0) {
    showToast('No sales records to export.', false);
    return;
  }
  const XLSXLib = window.XLSX;
  if (!XLSXLib) return showToast('Excel library loading, please retry.', false);

  try {
    const exportRows = currentFilteredSalesData.map((s, i) => ({
      'SL': i + 1,
      'Sale Date': s.date,
      'Register Serial': s.serial,
      'Farmer Name': s.farmerName,
      'Farmer Location': s.farmerLocation,
      'Fertilizer': s.fertilizer,
      'Quantity (kg)': s.quantityKg
    }));

    const worksheet = XLSXLib.utils.json_to_sheet(exportRows);
    const workbook = XLSXLib.utils.book_new();
    XLSXLib.utils.book_append_sheet(workbook, worksheet, 'Sales Records');
    const fileName = `Fertilizer_Sales_Records_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSXLib.writeFile(workbook, fileName);
    showToast('Sales Excel report downloaded!');
  } catch (err) {
    showToast('Export failed: ' + err.message, false);
  }
}

function exportSalesToPDF() {
  if (!currentFilteredSalesData || currentFilteredSalesData.length === 0) {
    showToast('No sales records to export.', false);
    return;
  }
  const jsPDFConstructor = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFConstructor) return showToast('PDF library loading, please retry.', false);

  try {
    const doc = new jsPDFConstructor('landscape');
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('Fertilizer Sales Distribution Records', 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | Total Records: ${currentFilteredSalesData.length}`, 14, 22);

    const headers = [['SL', 'Sale Date', 'Register Serial', 'Farmer Name', 'Location', 'Fertilizer', 'Quantity (kg)']];
    const body = currentFilteredSalesData.map((s, i) => [
      i + 1,
      s.date,
      s.serial,
      s.farmerName,
      s.farmerLocation,
      s.fertilizer,
      s.quantityKg.toLocaleString()
    ]);

    doc.autoTable({
      head: headers,
      body: body,
      startY: 26,
      theme: 'striped',
      headStyles: { fillColor: [4, 120, 87], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 6: { halign: 'right' } }
    });

    const fileName = `Fertilizer_Sales_Records_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    showToast('Sales PDF report downloaded!');
  } catch (err) {
    showToast('Export failed: ' + err.message, false);
  }
}

// ---------------------------------------------------------------------
// EXPORT HANDLERS: REGISTERED FARMERS DIRECTORY
// ---------------------------------------------------------------------
function exportFarmersToExcel() {
  if (!currentFilteredFarmersData || currentFilteredFarmersData.length === 0) {
    showToast('No farmer records to export.', false);
    return;
  }
  const XLSXLib = window.XLSX;
  if (!XLSXLib) return showToast('Excel library loading, please retry.', false);

  try {
    const exportRows = currentFilteredFarmersData.map((f, i) => ({
      'SL': i + 1,
      'Farmer Name': f.farmer_name,
      'Mobile': f.mobile,
      'NID': f.nid,
      'Village': f.village,
      'Ward': f.ward,
      'Block': f.block,
      'Union': f.union_name,
      'Upazila': f.upazila,
      'Land Area (dec)': f.land_area,
      'Land Type': f.land_type,
      'Khotian No': f.khotian_no || '',
      'Borga/PF Owner': f.borga_owner_name || f.pf_owner_name || '',
      'Crop Produced': f.crop_type,
      'Crop Details': f.crop_other_details || ''
    }));

    const worksheet = XLSXLib.utils.json_to_sheet(exportRows);
    const workbook = XLSXLib.utils.book_new();
    XLSXLib.utils.book_append_sheet(workbook, worksheet, 'Registered Farmers');
    const fileName = `Registered_Farmers_Directory_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSXLib.writeFile(workbook, fileName);
    showToast('Farmers Excel directory downloaded!');
  } catch (err) {
    showToast('Export failed: ' + err.message, false);
  }
}

function exportFarmersToPDF() {
  if (!currentFilteredFarmersData || currentFilteredFarmersData.length === 0) {
    showToast('No farmer records to export.', false);
    return;
  }
  const jsPDFConstructor = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFConstructor) return showToast('PDF library loading, please retry.', false);

  try {
    const doc = new jsPDFConstructor('landscape');
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('Registered Farmers Directory (Form 1 Records)', 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | Total Farmers: ${currentFilteredFarmersData.length}`, 14, 22);

    const headers = [['SL', 'Farmer Name', 'Mobile', 'NID', 'Address (Village, Ward, Block, Union)', 'Land Info', 'Crop Produced']];
    const body = currentFilteredFarmersData.map((f, i) => {
      let landInfo = `${f.land_area} dec (${f.land_type})`;
      if (f.khotian_no) landInfo += ` - Khotian: ${f.khotian_no}`;
      if (f.borga_owner_name) landInfo += ` - Owner: ${f.borga_owner_name}`;
      return [
        i + 1,
        f.farmer_name,
        f.mobile,
        f.nid,
        `${f.village}, W-${f.ward}, B-${f.block}, ${f.union_name}`,
        landInfo,
        f.crop_type === 'Others' ? `Others: ${f.crop_other_details || ''}` : f.crop_type
      ];
    });

    doc.autoTable({
      head: headers,
      body: body,
      startY: 26,
      theme: 'striped',
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 }
    });

    const fileName = `Registered_Farmers_Directory_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    showToast('Farmers PDF directory downloaded!');
  } catch (err) {
    showToast('Export failed: ' + err.message, false);
  }
}

// Summary Action Listeners
if (summaryGroupBy) summaryGroupBy.addEventListener('change', computeAndRenderDashboard);
if (btnExportExcel) btnExportExcel.addEventListener('click', exportToExcel);
if (btnExportPDF) btnExportPDF.addEventListener('click', exportToPDF);
if (btnPrintSummary) btnPrintSummary.addEventListener('click', printSummaryReport);

// Sales Action Listeners
if (btnExportSalesExcel) btnExportSalesExcel.addEventListener('click', exportSalesToExcel);
if (btnExportSalesPDF) btnExportSalesPDF.addEventListener('click', exportSalesToPDF);

// Farmers Action Listeners
if (btnExportFarmersExcel) btnExportFarmersExcel.addEventListener('click', exportFarmersToExcel);
if (btnExportFarmersPDF) btnExportFarmersPDF.addEventListener('click', exportFarmersToPDF);

// Filter listeners
[filterUpazila, filterUnion, filterBlock].forEach(el => el.addEventListener('change', computeAndRenderDashboard));
filterWard.addEventListener('input', computeAndRenderDashboard);
if (filterStartDate) filterStartDate.addEventListener('change', computeAndRenderDashboard);
if (filterEndDate) filterEndDate.addEventListener('change', computeAndRenderDashboard);
if (searchFarmerInput) {
  searchFarmerInput.addEventListener('input', computeAndRenderDashboard);
}

btnResetFilters.addEventListener('click', () => {
  filterUpazila.value = '';
  filterUnion.value = '';
  filterBlock.value = '';
  filterWard.value = '';
  if (filterStartDate) filterStartDate.value = '';
  if (filterEndDate) filterEndDate.value = '';
  if (searchFarmerInput) searchFarmerInput.value = '';
  computeAndRenderDashboard();
});

btnRefreshDashboard.addEventListener('click', () => {
  loadDashboardData();
  showToast('Dashboard data refreshed.');
});

// Initial boot
updateAuthUI();
switchView('dashboard');

