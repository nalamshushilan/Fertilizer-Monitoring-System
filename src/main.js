import { supabase, isSupabaseConfigured, Session, isValidUUID } from './supabase.js';

// Global State
let currentUser = Session.get(); // { role: 'dealer'|'admin'|'superadmin'|'contributor', dealer: {...}, contributor: {...} }
let farmersCache = [];
let dealersCache = [];
let transactionsCache = []; // Unified table: Transaction (replaces dealer_sales & dealer_registers)
let salesCache = [];
let registersCache = [];
let contributorsCache = [];

// DOM References
const navTabs = document.getElementById('navTabs');
const tabForm1 = document.getElementById('tabForm1');
const tabForm3 = document.getElementById('tabForm3');
const tabForm4 = document.getElementById('tabForm4');
const tabContributor = document.getElementById('tabContributor');

const userProfileBar = document.getElementById('userProfileBar');
const userRoleBadge = document.getElementById('userRoleBadge');
const userNameDisplay = document.getElementById('userNameDisplay');
const btnLogout = document.getElementById('btnLogout');
const btnLoginNav = document.getElementById('btnLoginNav');
const globalAlert = document.getElementById('globalAlert');
const toast = document.getElementById('toast');

// Dealer Dashboard Banner & Metrics Elements
const dealerDashboardBadge = document.getElementById('dealerDashboardBadge');
const dealerDashboardName = document.getElementById('dealerDashboardName');
const dealerDashboardReg = document.getElementById('dealerDashboardReg');
const fg_filterDealer = document.getElementById('fg_filterDealer');
const filterDealer = document.getElementById('filterDealer');
const metricFarmerLabel = document.getElementById('metricFarmerLabel');
const metricSoldLabel = document.getElementById('metricSoldLabel');
const metricStockLabel = document.getElementById('metricStockLabel');
const metricFarmerDesc = document.getElementById('metricFarmerDesc');
const metricSoldDesc = document.getElementById('metricSoldDesc');
const metricStockDesc = document.getElementById('metricStockDesc');
const fertilizerTableTitle = document.getElementById('fertilizerTableTitle');
const summaryReportTitle = document.getElementById('summaryReportTitle');
const recentSalesTitle = document.getElementById('recentSalesTitle');
const farmersDirectoryTitle = document.getElementById('farmersDirectoryTitle');

// Views
const views = {
  dashboard: document.getElementById('viewDashboard'),
  form1: document.getElementById('viewForm1'),
  form3: document.getElementById('viewForm3'),
  form4: document.getElementById('viewForm4'),
  contributor: document.getElementById('viewContributor'),
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
  if (viewName === 'contributor') {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      showToast('Only Admin can access Add contributor.', false);
      switchView('dashboard');
      return;
    }
  }

  if (viewName === 'form3') {
    // Admin access removed for stock register
    if (!currentUser) {
      showToast('Please sign in to access this form.', false);
      switchView('auth');
      return;
    }
    if (currentUser.role === 'admin' || currentUser.role === 'superadmin') {
      showToast('Admin does not have access to stock register form.', false);
      switchView('dashboard');
      return;
    }
  }

  if (viewName === 'form4') {
    // Admin and Contributor have access; Dealer does not
    if (!currentUser || currentUser.role === 'dealer') {
      showToast('Dealer does not have access to Add dealer form.', false);
      switchView(currentUser ? 'dashboard' : 'auth');
      return;
    }
  }

  if (viewName === 'form1') {
    // Dealer and Contributor have access; if unauthenticated, ask to login
    if (!currentUser) {
      showToast('Please sign in to access Add farmer.', false);
      switchView('auth');
      return;
    }
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
  } else if (viewName === 'form3') {
    populateFarmersDropdown();
    loadDealerRegisterTable();
  } else if (viewName === 'form4') {
    loadDealersTable();
  } else if (viewName === 'contributor') {
    loadContributorsTable();
  }
}

function updateAuthUI() {
  if (currentUser) {
    userProfileBar.classList.remove('hidden');
    btnLoginNav.classList.add('hidden');
    
    userRoleBadge.className = `user-role-pill role-${currentUser.role}`;
    userRoleBadge.textContent = currentUser.role;

    if (currentUser.role === 'dealer') {
      userNameDisplay.textContent = `${currentUser.dealer?.dealer_name || 'Dealer'} (${currentUser.dealer?.registration_number || ''})`;
      tabForm1.classList.remove('hidden');
      tabForm3.classList.remove('hidden');
      tabForm4.classList.add('hidden');
      if (tabContributor) tabContributor.classList.add('hidden');

      // Dealer Private Dashboard Banner & Metric customization
      if (dealerDashboardBadge) dealerDashboardBadge.classList.remove('hidden');
      if (dealerDashboardName) dealerDashboardName.textContent = currentUser.dealer?.dealer_name || 'Dealer Store';
      if (dealerDashboardReg) dealerDashboardReg.textContent = `(Reg: ${currentUser.dealer?.registration_number || ''}) • ${currentUser.dealer?.union_name || ''}, ${currentUser.dealer?.upazila || ''}`;

      if (metricFarmerLabel) metricFarmerLabel.textContent = "Dealer's Farmers Served";
      if (metricSoldLabel) metricSoldLabel.textContent = "Dealer's Fertilizer Sold";
      if (metricStockLabel) metricStockLabel.textContent = "Dealer's Store Closing Stock";

      if (metricFarmerDesc) metricFarmerDesc.textContent = 'Unique farmers served by your dealership';
      if (metricSoldDesc) metricSoldDesc.textContent = 'Fertilizer sold by your dealership';
      if (metricStockDesc) metricStockDesc.textContent = `Available stock in ${currentUser.dealer?.dealer_name || 'your dealership'}`;

      if (fertilizerTableTitle) fertilizerTableTitle.textContent = `🧪 ${currentUser.dealer?.dealer_name || 'Dealership'} Stock Breakdown: Urea • TSP • MoP • DAP`;
      if (summaryReportTitle) summaryReportTitle.textContent = `📈 ${currentUser.dealer?.dealer_name || 'Dealership'} Stock & Sales Summary Report`;
      if (recentSalesTitle) recentSalesTitle.textContent = `📋 Recent Sales Records (${currentUser.dealer?.dealer_name || 'Your Dealership'})`;
      if (farmersDirectoryTitle) farmersDirectoryTitle.textContent = `👨‍🌾 Farmers Registered by ${currentUser.dealer?.dealer_name || 'Your Dealership'}`;

      // Hide dealer filter from logged-in dealer (only accessible for Admin and Contributor)
      if (fg_filterDealer) fg_filterDealer.style.display = 'none';

      // Allow dealer to view and filter all farmers across all unions
      if (filterUpazila) filterUpazila.disabled = false;
      if (filterUnion) filterUnion.disabled = false;
    } else if (currentUser.role === 'contributor') {
      userNameDisplay.textContent = `${currentUser.name || currentUser.contributor?.full_name || 'Contributor'} (@${currentUser.contributor?.username || ''})`;
      tabForm1.classList.remove('hidden');
      tabForm3.classList.remove('hidden');
      tabForm4.classList.remove('hidden');
      if (tabContributor) tabContributor.classList.add('hidden'); // Only Admin can add contributor

      if (dealerDashboardBadge) dealerDashboardBadge.classList.add('hidden');

      // Dealer filter visible for Contributor
      if (fg_filterDealer) fg_filterDealer.style.display = 'block';

      if (metricFarmerLabel) metricFarmerLabel.textContent = "Farmers Received Fertilizer";
      if (metricSoldLabel) metricSoldLabel.textContent = "Total Fertilizer Sold";
      if (metricStockLabel) metricStockLabel.textContent = "Total Stock Status (All Dealers)";

      if (metricFarmerDesc) metricFarmerDesc.textContent = 'Total unique farmers with fertilizer purchases';
      if (metricSoldDesc) metricSoldDesc.textContent = 'Total fertilizer distributed (in kg)';
      if (metricStockDesc) metricStockDesc.textContent = 'Available fertilizer across dealers';

      if (fertilizerTableTitle) fertilizerTableTitle.textContent = '🧪 Total Fertilizer Breakdown Across All Dealers: Urea • TSP • MoP • DAP';
      if (summaryReportTitle) summaryReportTitle.textContent = '📈 All Dealers Fertilizer Distribution & Stock Summary Report';
      if (recentSalesTitle) recentSalesTitle.textContent = '📋 Recent Sales Records (All Dealers)';
      if (farmersDirectoryTitle) farmersDirectoryTitle.textContent = '👨‍🌾 Registered Farmers Directory';

      if (filterUpazila) filterUpazila.disabled = false;
      if (filterUnion) filterUnion.disabled = false;
    } else {
      // Admin / Superadmin
      userNameDisplay.textContent = currentUser.name || 'System Admin';
      tabForm1.classList.add('hidden'); // Admin removed from farmer registration or focus only on admin tasks
      tabForm3.classList.add('hidden'); // Admin removed from register
      tabForm4.classList.remove('hidden'); // Admin can add dealer
      if (tabContributor) tabContributor.classList.remove('hidden'); // Admin can add contributor

      if (dealerDashboardBadge) dealerDashboardBadge.classList.add('hidden');

      // Dealer filter visible for Admin
      if (fg_filterDealer) fg_filterDealer.style.display = 'block';

      if (metricFarmerLabel) metricFarmerLabel.textContent = "Farmers Received Fertilizer";
      if (metricSoldLabel) metricSoldLabel.textContent = "Total Fertilizer Sold";
      if (metricStockLabel) metricStockLabel.textContent = "Total Stock Status (All Dealers)";

      if (metricFarmerDesc) metricFarmerDesc.textContent = 'Total unique farmers with fertilizer purchases';
      if (metricSoldDesc) metricSoldDesc.textContent = 'Total fertilizer distributed (in kg)';
      if (metricStockDesc) metricStockDesc.textContent = 'Available fertilizer across dealers';

      if (fertilizerTableTitle) fertilizerTableTitle.textContent = '🧪 Total Fertilizer Breakdown Across All Dealers: Urea • TSP • MoP • DAP';
      if (summaryReportTitle) summaryReportTitle.textContent = '📈 All Dealers Fertilizer Distribution & Stock Summary Report';
      if (recentSalesTitle) recentSalesTitle.textContent = '📋 Recent Sales Records (All Dealers)';
      if (farmersDirectoryTitle) farmersDirectoryTitle.textContent = '👨‍🌾 Registered Farmers Directory';

      if (filterUpazila) filterUpazila.disabled = false;
      if (filterUnion) filterUnion.disabled = false;
    }
  } else {
    userProfileBar.classList.add('hidden');
    btnLoginNav.classList.remove('hidden');
    tabForm1.classList.add('hidden');
    tabForm3.classList.add('hidden');
    tabForm4.classList.add('hidden');
    if (tabContributor) tabContributor.classList.add('hidden');

    if (dealerDashboardBadge) dealerDashboardBadge.classList.add('hidden');

    // Dealer filter visible for public / guest view
    if (fg_filterDealer) fg_filterDealer.style.display = 'block';

    if (metricFarmerLabel) metricFarmerLabel.textContent = "Farmers Received Fertilizer";
    if (metricSoldLabel) metricSoldLabel.textContent = "Total Fertilizer Sold";
    if (metricStockLabel) metricStockLabel.textContent = "Total Stock Status (All Dealers)";

    if (metricFarmerDesc) metricFarmerDesc.textContent = 'Total unique farmers with fertilizer purchases';
    if (metricSoldDesc) metricSoldDesc.textContent = 'Total fertilizer distributed (in kg)';
    if (metricStockDesc) metricStockDesc.textContent = 'Available fertilizer across dealers';

    if (fertilizerTableTitle) fertilizerTableTitle.textContent = '🧪 Total Fertilizer Breakdown Across All Dealers: Urea • TSP • MoP • DAP';
    if (summaryReportTitle) summaryReportTitle.textContent = '📈 All Dealers Fertilizer Distribution & Stock Summary Report';
    if (recentSalesTitle) recentSalesTitle.textContent = '📋 Recent Sales Records (All Dealers)';
    if (farmersDirectoryTitle) farmersDirectoryTitle.textContent = '👨‍🌾 Registered Farmers Directory';

    if (filterUpazila) filterUpazila.disabled = false;
    if (filterUnion) filterUnion.disabled = false;
  }
}

// ---------------------------------------------------------------------
// AUTHENTICATION CONTROLLER
// ---------------------------------------------------------------------
const loginForm = document.getElementById('loginForm');
const dealerLoginFields = document.getElementById('dealerLoginFields');
const contributorLoginFields = document.getElementById('contributorLoginFields');
const adminLoginFields = document.getElementById('adminLoginFields');
const loginRegNo = document.getElementById('loginRegNo');
const loginDealerPass = document.getElementById('loginDealerPass');
const loginContributorUsername = document.getElementById('loginContributorUsername');
const loginContributorPass = document.getElementById('loginContributorPass');
const adminKeyInput = document.getElementById('adminKeyInput');

document.querySelectorAll('input[name="loginRole"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const val = e.target.value;
    dealerLoginFields.classList.toggle('hidden', val !== 'dealer');
    if (contributorLoginFields) contributorLoginFields.classList.toggle('hidden', val !== 'contributor');
    adminLoginFields.classList.toggle('hidden', val !== 'admin');
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
        dealer: { id: '00000000-0000-0000-0000-000000000001', registration_number: regNo, dealer_name: 'Demo Dealer Enterprise', upazila: 'Ukhiya', union_name: 'Raja Palong' }
      };
      Session.set(currentUser);
      updateAuthUI();
      showToast(`Welcome back, ${currentUser.dealer.dealer_name}!`);
      switchView('dashboard');
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
      switchView('dashboard');
    } catch (err) {
      showAlert('Login error: ' + err.message);
    }
  } else if (role === 'contributor') {
    // Contributor login
    const username = loginContributorUsername ? loginContributorUsername.value.trim() : '';
    const pass = loginContributorPass ? loginContributorPass.value : '';

    if (!username || !pass) {
      showAlert('Please enter Contributor Username and Password.');
      return;
    }

    if (!isSupabaseConfigured) {
      // Find from cache or mock
      const found = contributorsCache.find(c => c.username === username && c.password === pass);
      if (found) {
        currentUser = {
          role: 'contributor',
          contributor: found,
          name: found.full_name
        };
      } else {
        currentUser = {
          role: 'contributor',
          contributor: { id: 'c-demo', username, full_name: 'Contributor (' + username + ')' },
          name: 'Contributor (' + username + ')'
        };
      }
      Session.set(currentUser);
      updateAuthUI();
      showToast(`Welcome back, ${currentUser.name}!`);
      switchView('form1');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('contributors')
        .select('*')
        .eq('username', username)
        .eq('password', pass)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        showAlert('Invalid Contributor Username or Password. Please contact Admin.');
        return;
      }

      currentUser = {
        role: 'contributor',
        contributor: data,
        name: data.full_name
      };
      Session.set(currentUser);
      updateAuthUI();
      showToast(`Welcome back, ${data.full_name}!`);
      switchView('form1');
    } catch (err) {
      showAlert('Contributor login error: ' + err.message);
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
// FORM 1: FARMER'S INFO & RAW FARMER LIST REFERENCE SEARCH
// ---------------------------------------------------------------------
const formFarmer = document.getElementById('formFarmer');
const sectionKhotian = document.getElementById('sectionKhotian');
const sectionBorga = document.getElementById('sectionBorga');
const sectionPF = document.getElementById('sectionPF');
const sectionOtherCrop = document.getElementById('sectionOtherCrop');

const rawFarmerSearchInput = document.getElementById('rawFarmerSearchInput');
const btnSearchRawFarmer = document.getElementById('btnSearchRawFarmer');
const btnClearRawSearch = document.getElementById('btnClearRawSearch');
const rawSearchStatus = document.getElementById('rawSearchStatus');

// Sample Raw Farmers (for instant local demonstration & offline fallback)
const SAMPLE_RAW_FARMERS = [
  {
    farmer_name: "Abdul Jalil",
    village: "Rajapalong",
    block: "1",
    ward: "Ward 1",
    union_name: "Raja Palong",
    upazila: "Ukhiya",
    nid: "1982123456789",
    mobile: "01819123456"
  },
  {
    farmer_name: "Nurul Islam",
    village: "Sonarpara",
    block: "2",
    ward: "Ward 3",
    union_name: "Jalia Palong",
    upazila: "Ukhiya",
    nid: "1975987654321",
    mobile: "01712987654"
  },
  {
    farmer_name: "Mohammad Hossain",
    village: "Balukhali",
    block: "3",
    ward: "Ward 5",
    union_name: "Palong Khali",
    upazila: "Ukhiya",
    nid: "1990456123789",
    mobile: "01611223344"
  },
  {
    farmer_name: "Kamal Uddin",
    village: "Ratnapalong",
    block: "1",
    ward: "Ward 2",
    union_name: "Ratna Palong",
    upazila: "Ukhiya",
    nid: "1988334455667",
    mobile: "01918765432"
  },
  {
    farmer_name: "Zahir Ahmed",
    village: "Holdiapalong",
    block: "2",
    ward: "Ward 4",
    union_name: "Holdia Palong",
    upazila: "Ukhiya",
    nid: "1984556677889",
    mobile: "01822334455"
  }
];

async function searchRawFarmer(queryVal, isAutoTrigger = false) {
  const query = (queryVal || '').trim();
  if (!query) {
    if (!isAutoTrigger && rawSearchStatus) {
      rawSearchStatus.style.display = 'block';
      rawSearchStatus.style.background = 'rgba(239, 68, 68, 0.15)';
      rawSearchStatus.style.border = '1px solid rgba(239, 68, 68, 0.4)';
      rawSearchStatus.style.color = '#fca5a5';
      rawSearchStatus.innerHTML = '⚠️ Please enter an NID or Mobile number to search.';
    }
    return;
  }

  if (rawSearchStatus) {
    rawSearchStatus.style.display = 'block';
    rawSearchStatus.style.background = 'rgba(59, 130, 246, 0.15)';
    rawSearchStatus.style.border = '1px solid rgba(59, 130, 246, 0.4)';
    rawSearchStatus.style.color = '#93c5fd';
    rawSearchStatus.innerHTML = `🔍 Searching Raw Farmer List for <strong>"${query}"</strong>...`;
  }

  let matchedRecord = null;

  // 1. Try querying remote Supabase table 'Raw-farmer-list' or 'raw_farmer_list'
  if (isSupabaseConfigured) {
    try {
      let res = await supabase
        .from('Raw-farmer-list')
        .select('*')
        .or(`nid.eq.${query},mobile.eq.${query}`)
        .limit(1);

      if (res.error) {
        res = await supabase
          .from('raw_farmer_list')
          .select('*')
          .or(`nid.eq.${query},mobile.eq.${query}`)
          .limit(1);
      }

      if (!res.error && res.data && res.data.length > 0) {
        matchedRecord = res.data[0];
      }
    } catch (e) {
      console.warn('Raw farmer list remote search note:', e);
    }
  }

  // 2. Fallback to sample reference raw farmers
  if (!matchedRecord) {
    matchedRecord = SAMPLE_RAW_FARMERS.find(rf => 
      (rf.nid && rf.nid.trim() === query) || 
      (rf.mobile && rf.mobile.trim() === query) ||
      (rf.nid && rf.nid.replace(/\D/g, '') === query.replace(/\D/g, '')) ||
      (rf.mobile && rf.mobile.replace(/\D/g, '') === query.replace(/\D/g, ''))
    );
  }

  // 3. Process matched or not matched
  if (matchedRecord) {
    const nameField = document.getElementById('f_name');
    const villageField = document.getElementById('f_village');
    const blockField = document.getElementById('f_block');
    const wardField = document.getElementById('f_ward');
    const upazilaField = document.getElementById('f_upazila');
    const unionField = document.getElementById('f_union');
    const nidField = document.getElementById('f_nid');
    const mobileField = document.getElementById('f_mobile');

    if (nameField) nameField.value = matchedRecord.farmer_name || matchedRecord.name || '';
    if (villageField) villageField.value = matchedRecord.village || matchedRecord.village_name || '';

    if (blockField) {
      let bVal = String(matchedRecord.block || '').replace(/\D/g, '');
      if (['1', '2', '3'].includes(bVal)) {
        blockField.value = bVal;
      } else {
        blockField.value = matchedRecord.block || '';
      }
    }

    if (wardField) wardField.value = matchedRecord.ward || matchedRecord.ward_no || '';
    if (upazilaField) upazilaField.value = 'Ukhiya';

    if (unionField) {
      const uName = (matchedRecord.union_name || matchedRecord.union || '').trim();
      const matchedOpt = Array.from(unionField.options).find(opt => opt.value.toLowerCase() === uName.toLowerCase());
      if (matchedOpt) {
        unionField.value = matchedOpt.value;
      } else if (uName) {
        unionField.value = uName;
      }
    }

    if (nidField) nidField.value = matchedRecord.nid || '';
    if (mobileField) mobileField.value = matchedRecord.mobile || '';

    if (rawSearchStatus) {
      rawSearchStatus.style.display = 'block';
      rawSearchStatus.style.background = 'rgba(16, 185, 129, 0.15)';
      rawSearchStatus.style.border = '1px solid rgba(16, 185, 129, 0.5)';
      rawSearchStatus.style.color = '#6ee7b7';
      rawSearchStatus.innerHTML = `
        <div style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
          <span>✅</span> Farmer record found in Raw Farmer List!
        </div>
        <div style="margin-top: 4px; color: #e5e7eb;">
          <strong>${matchedRecord.farmer_name || matchedRecord.name}</strong> • NID: <code>${matchedRecord.nid || 'N/A'}</code> • Mobile: <code>${matchedRecord.mobile || 'N/A'}</code>
        </div>
        <div style="margin-top: 6px; font-size: 0.82rem; color: #a7f3d0;">
          👉 Basic info (Parts 1 to 4) auto-filled. Please fill remaining fields (Parts 5 to 8) below.
        </div>
      `;
    }

    // Highlight animation on auto-filled inputs
    [nameField, villageField, blockField, wardField, unionField, nidField, mobileField].filter(Boolean).forEach(el => {
      el.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
      el.style.borderColor = '#10b981';
      el.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.3)';
      setTimeout(() => {
        el.style.borderColor = '';
        el.style.boxShadow = '';
      }, 1800);
    });

    const landAreaField = document.getElementById('f_land_area');
    if (landAreaField) {
      setTimeout(() => landAreaField.focus(), 300);
    }
    showToast(`✓ Auto-filled basic info for ${matchedRecord.farmer_name || 'Farmer'}!`);
  } else {
    // Farmer not found: inform user and allow manual typing of 1 to 4
    if (rawSearchStatus) {
      rawSearchStatus.style.display = 'block';
      rawSearchStatus.style.background = 'rgba(245, 158, 11, 0.15)';
      rawSearchStatus.style.border = '1px solid rgba(245, 158, 11, 0.4)';
      rawSearchStatus.style.color = '#fde68a';
      rawSearchStatus.innerHTML = `
        <div style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
          <span>ℹ️</span> Farmer with NID / Mobile "<strong>${query}</strong>" not found in Raw Farmer List.
        </div>
        <div style="margin-top: 4px; color: #e5e7eb; font-size: 0.85rem;">
          Please type farmer basic info (Parts 1 to 4) manually below and proceed with registration.
        </div>
      `;
    }

    const nidField = document.getElementById('f_nid');
    const mobileField = document.getElementById('f_mobile');
    const digitsOnly = query.replace(/\D/g, '');
    if (digitsOnly.length === 11 && digitsOnly.startsWith('01') && mobileField && !mobileField.value) {
      mobileField.value = digitsOnly;
    } else if (digitsOnly.length >= 10 && nidField && !nidField.value) {
      nidField.value = digitsOnly;
    }

    const nameField = document.getElementById('f_name');
    if (nameField && !nameField.value) {
      nameField.focus();
    }
  }
}

if (btnSearchRawFarmer) {
  btnSearchRawFarmer.addEventListener('click', () => {
    searchRawFarmer(rawFarmerSearchInput?.value || '');
  });
}

if (rawFarmerSearchInput) {
  rawFarmerSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchRawFarmer(rawFarmerSearchInput.value);
    }
  });
}

if (btnClearRawSearch) {
  btnClearRawSearch.addEventListener('click', () => {
    if (rawFarmerSearchInput) rawFarmerSearchInput.value = '';
    if (rawSearchStatus) {
      rawSearchStatus.style.display = 'none';
      rawSearchStatus.innerHTML = '';
    }
  });
}

// Auto-search trigger when user enters NID or Mobile directly in Section 3 & 4
let rawSearchDebounceTimer = null;
function handleFieldAutoSearch(val) {
  const cleanVal = (val || '').trim();
  if (cleanVal.length === 10 || cleanVal.length === 13 || cleanVal.length === 17 || cleanVal.length === 11) {
    clearTimeout(rawSearchDebounceTimer);
    rawSearchDebounceTimer = setTimeout(() => {
      const fName = document.getElementById('f_name');
      if (!fName || !fName.value.trim()) {
        if (rawFarmerSearchInput) rawFarmerSearchInput.value = cleanVal;
        searchRawFarmer(cleanVal, true);
      }
    }, 500);
  }
}

const f_nid_input = document.getElementById('f_nid');
const f_mobile_input = document.getElementById('f_mobile');
if (f_nid_input) f_nid_input.addEventListener('input', (e) => handleFieldAutoSearch(e.target.value));
if (f_mobile_input) f_mobile_input.addEventListener('input', (e) => handleFieldAutoSearch(e.target.value));

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
    dealer_id: isValidUUID(currentUser?.dealer?.id) ? currentUser.dealer.id : null,
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
    farmersCache.unshift({ id: 'f-' + Date.now(), ...farmerPayload });
    showToast(`Farmer ${farmerPayload.farmer_name} registered successfully (Demo Mode)!`);
    formFarmer.reset();
    if (rawFarmerSearchInput) rawFarmerSearchInput.value = '';
    if (rawSearchStatus) rawSearchStatus.style.display = 'none';
    return;
  }

  try {
    const { data, error } = await supabase.from('farmers').insert([farmerPayload]).select().single();
    if (error) {
      if (error.message.includes('nid')) throw new Error('Farmer with this NID already exists.');
      if (error.message.includes('mobile')) throw new Error('Farmer with this Mobile number already exists.');
      throw error;
    }

    farmersCache.unshift(data);
    showToast(`Farmer ${data.farmer_name} registered successfully!`);
    formFarmer.reset();
    if (rawFarmerSearchInput) rawFarmerSearchInput.value = '';
    if (rawSearchStatus) rawSearchStatus.style.display = 'none';
  } catch (err) {
    showAlert('Error saving Farmer info: ' + err.message);
  }
});

// ---------------------------------------------------------------------
// STOCK REGISTER (UNIFIED TRANSACTIONS) & FARMER SELECTION CONTROLLER
// Formula: Closing Stock = Opening Stock + Received - Issued
// ---------------------------------------------------------------------
const formRegister = document.getElementById('formRegister');
const dealerRegisterTableBody = document.getElementById('dealerRegisterTableBody');
const r_transaction_type = document.getElementById('r_transaction_type');
const r_reference_no = document.getElementById('r_reference_no');
const r_received_qty = document.getElementById('r_received_qty');
const r_issued_qty = document.getElementById('r_issued_qty');
const r_remarks = document.getElementById('r_remarks');
const r_farmer_id = document.getElementById('r_farmer_id');
const fg_farmer_select = document.getElementById('fg_farmer_select');
const fg_received_qty = document.getElementById('fg_received_qty');
const fg_issued_qty = document.getElementById('fg_issued_qty');

async function populateFarmersDropdown() {
  if (!r_farmer_id) return;
  r_farmer_id.innerHTML = '<option value="">-- Choose Registered Farmer (Search by NID/Name) --</option>';

  if (!isSupabaseConfigured) {
    farmersCache.forEach(f => {
      r_farmer_id.innerHTML += `<option value="${f.id}">${f.farmer_name} (NID: ${f.nid} • Mobile: ${f.mobile})</option>`;
    });
    return;
  }

  try {
    // All dealers are allowed to view and select all registered farmers registered by all dealers
    const { data, error } = await supabase
      .from('farmers')
      .select('*')
      .order('farmer_name', { ascending: true });
    if (error) throw error;

    const list = data || [];
    farmersCache = list;
    list.forEach(f => {
      r_farmer_id.innerHTML += `<option value="${f.id}">${f.farmer_name} (NID: ${f.nid} • ${f.village}, ${f.union_name})</option>`;
    });
  } catch (err) {
    console.warn('Error loading farmers dropdown:', err);
  }
}

// Dynamic field defaults when transaction type changes
if (r_transaction_type) {
  r_transaction_type.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'OPENING') {
      if (fg_farmer_select) fg_farmer_select.style.display = 'none';
      if (fg_received_qty) fg_received_qty.style.display = 'block';
      if (fg_issued_qty) fg_issued_qty.style.display = 'none';
      if (r_reference_no) r_reference_no.value = 'Opening Balance';
      if (r_received_qty) r_received_qty.value = 500;
      if (r_issued_qty) r_issued_qty.value = 0;
      if (r_remarks) r_remarks.value = 'Initial stock balance';
    } else if (val === 'RECEIVED') {
      if (fg_farmer_select) fg_farmer_select.style.display = 'none';
      if (fg_received_qty) fg_received_qty.style.display = 'block';
      if (fg_issued_qty) fg_issued_qty.style.display = 'none';
      if (r_reference_no) r_reference_no.value = 'Challan-' + Date.now().toString().slice(-4);
      if (r_received_qty) r_received_qty.value = '';
      if (r_issued_qty) r_issued_qty.value = 0;
      if (r_remarks) r_remarks.value = 'Stock received from buffer warehouse';
    } else if (val === 'ISSUED') {
      if (fg_farmer_select) {
        fg_farmer_select.style.display = 'block';
        populateFarmersDropdown();
      }
      if (fg_received_qty) fg_received_qty.style.display = 'none';
      if (fg_issued_qty) fg_issued_qty.style.display = 'block';
      if (r_reference_no) r_reference_no.value = 'Memo-' + Date.now().toString().slice(-4);
      if (r_received_qty) r_received_qty.value = 0;
      if (r_issued_qty) r_issued_qty.value = '';
      if (r_remarks) r_remarks.value = 'Fertilizer issued / sold';
    }
  });
}

// Set default transaction date to today
if (document.getElementById('r_date')) {
  document.getElementById('r_date').valueAsDate = new Date();
}

async function loadDealerRegisterTable() {
  if (!dealerRegisterTableBody) return;
  dealerRegisterTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:18px;">Loading stock register...</td></tr>`;

  if (!isSupabaseConfigured) {
    renderRegisterTable(transactionsCache);
    return;
  }

  try {
    let txList = [];
    let query = supabase.from('transactions').select('*').order('transaction_date', { ascending: true }).order('created_at', { ascending: true });
    const validDealerId = isValidUUID(currentUser?.dealer?.id) ? currentUser.dealer.id : null;
    if (validDealerId) {
      query = query.eq('dealer_id', validDealerId);
    }
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      txList = data;
    } else {
      let queryAlt = supabase.from('Transaction').select('*').order('transaction_date', { ascending: true });
      if (validDealerId) queryAlt = queryAlt.eq('dealer_id', validDealerId);
      const resAlt = await queryAlt;
      if (!resAlt.error && resAlt.data && resAlt.data.length > 0) {
        txList = resAlt.data;
      } else {
        txList = transactionsCache;
        if (validDealerId) {
          txList = txList.filter(t => t.dealer_id === validDealerId);
        }
      }
    }
    renderRegisterTable(txList);
  } catch (err) {
    renderRegisterTable(transactionsCache);
  }
}

// Render Stock Register with exact Formula: Closing Stock = Opening Stock + Received - Issued
function renderRegisterTable(items) {
  if (!dealerRegisterTableBody) return;
  if (!items || items.length === 0) {
    dealerRegisterTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:18px; color:var(--text-muted);">No stock register entries yet.</td></tr>`;
    return;
  }

  // Calculate Running Closing Stock per fertilizer:
  // Closing Stock = Opening Stock + Received - Issued
  const runningStock = { Urea: 0, TSP: 0, MoP: 0, DAP: 0 };

  // Sort ascending by date for chronological stock calculation
  const sorted = [...items].sort((a, b) => {
    const da = a.transaction_date || a.sale_date || a.record_date || '';
    const db = b.transaction_date || b.sale_date || b.record_date || '';
    return da > db ? 1 : (da < db ? -1 : 0);
  });

  const calculatedRows = sorted.map(item => {
    const fert = item.fertilizer_name || 'Urea';
    const rawType = (item.transaction_type || item.status_type || (item.sale_date ? 'ISSUED' : 'OPENING')).toUpperCase();
    const type = rawType.includes('OPEN') ? 'OPENING' : (rawType.includes('REC') ? 'RECEIVED' : 'ISSUED');
    
    let recQty = parseFloat(item.received_qty) || 0;
    let issQty = parseFloat(item.issued_qty) || 0;
    const qty = parseFloat(item.quantity_kg) || 0;

    if (recQty === 0 && issQty === 0 && qty > 0) {
      if (type === 'OPENING' || type === 'RECEIVED') recQty = qty;
      else if (type === 'ISSUED') issQty = qty;
    }

    // Formula: Closing Stock = Opening Stock + Received - Issued
    const prevStock = runningStock[fert] || 0;
    let newClosing = 0;
    if (type === 'OPENING') {
      newClosing = recQty;
      runningStock[fert] = newClosing;
    } else {
      newClosing = prevStock + recQty - issQty;
      runningStock[fert] = newClosing;
    }

    return {
      date: item.transaction_date || item.sale_date || item.record_date || 'N/A',
      fertilizer: fert,
      type: type,
      referenceNo: item.reference_no || item.register_serial_no || (type === 'OPENING' ? 'Opening Balance' : '-'),
      farmer: item.customer || (item.farmers ? item.farmers.farmer_name : (item.farmer_id ? 'Farmer' : 'Blank')),
      receivedQty: recQty,
      issuedQty: issQty,
      closingStock: newClosing,
      remarks: item.remarks || (type === 'OPENING' ? 'Initial stock balance' : '-')
    };
  });

  // Display newest first
  const displayList = [...calculatedRows].reverse();

  dealerRegisterTableBody.innerHTML = displayList.map(r => {
    const typeBadge = r.type === 'OPENING' 
      ? '<span class="user-role-pill" style="background:#2563eb;">OPENING</span>'
      : (r.type === 'RECEIVED' 
          ? '<span class="user-role-pill" style="background:#059669;">RECEIVED</span>' 
          : '<span class="user-role-pill" style="background:#d97706;">ISSUED</span>');

    return `
      <tr>
        <td><code>${r.date}</code></td>
        <td><strong>${r.fertilizer}</strong></td>
        <td>${typeBadge}</td>
        <td><code>${r.referenceNo}</code></td>
        <td>${r.farmer}</td>
        <td style="text-align: right; color:#34d399; font-weight:600;">${r.receivedQty > 0 ? `+${r.receivedQty.toLocaleString()} kg` : '-'}</td>
        <td style="text-align: right; color:#f87171; font-weight:600;">${r.issuedQty > 0 ? `-${r.issuedQty.toLocaleString()} kg` : '-'}</td>
        <td style="text-align: right; color:#60a5fa; font-weight:700; font-size:0.98rem;">${r.closingStock.toLocaleString()} kg</td>
        <td style="font-size:0.82rem; color:var(--text-muted);">${r.remarks}</td>
      </tr>
    `;
  }).join('');
}

if (formRegister) {
  formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    showAlert(null);

    if (!currentUser || (currentUser.role !== 'dealer' && currentUser.role !== 'contributor')) {
      showAlert('Only Dealers and Contributors can record stock transactions.');
      return;
    }

    const type = r_transaction_type ? r_transaction_type.value : 'OPENING';
    const recQty = type === 'ISSUED' ? 0 : (parseFloat(r_received_qty?.value) || 0);
    const issQty = type === 'ISSUED' ? (parseFloat(r_issued_qty?.value) || 0) : 0;
    
    if (type === 'RECEIVED' && recQty <= 0) {
      showAlert('Please enter a valid Received Quantity (kg).');
      return;
    }
    if (type === 'ISSUED' && issQty <= 0) {
      showAlert('Please enter a valid Issued Quantity (kg).');
      return;
    }
    if (type === 'OPENING' && recQty < 0) {
      showAlert('Please enter a valid Opening Stock Quantity (kg).');
      return;
    }

    const refNo = r_reference_no?.value.trim() || (type === 'OPENING' ? 'Opening Balance' : (type === 'ISSUED' ? 'Memo-01' : 'Challan-01'));
    
    let farmerId = null;
    let customerVal = 'Blank';

    if (type === 'ISSUED') {
      farmerId = r_farmer_id ? (r_farmer_id.value || null) : null;
      if (!farmerId) {
        showAlert('Please select a registered farmer for fertilizer issue / sale.');
        return;
      }
      const farmerOpt = r_farmer_id?.options[r_farmer_id.selectedIndex];
      customerVal = farmerOpt ? farmerOpt.text.split('(')[0].trim() : 'Registered Farmer';
    } else {
      farmerId = null;
      customerVal = 'Blank';
    }

    const remarksVal = r_remarks?.value.trim() || (type === 'OPENING' ? 'Initial stock balance' : (type === 'ISSUED' ? 'Stock issued' : 'Stock received'));
    const fertVal = document.getElementById('r_fertilizer').value;
    const dateVal = document.getElementById('r_date').value;

    const txPayload = {
      dealer_id: isValidUUID(currentUser?.dealer?.id) 
        ? currentUser.dealer.id 
        : (dealersCache.find(d => isValidUUID(d.id))?.id || null),
      transaction_date: dateVal,
      fertilizer_name: fertVal,
      transaction_type: type,
      reference_no: refNo,
      customer_id: farmerId,
      received_qty: recQty,
      issued_qty: issQty,
      remarks: remarksVal
    };

    if (!isSupabaseConfigured) {
      txPayload.id = 'tx-' + Date.now();
      txPayload.farmer_id = farmerId;
      txPayload.register_serial_no = refNo;
      txPayload.quantity_kg = type === 'ISSUED' ? issQty : (recQty > 0 ? recQty : issQty);
      transactionsCache.unshift(txPayload);
      if (type === 'ISSUED') {
        salesCache.unshift(txPayload);
        if (r_issued_qty) r_issued_qty.value = '';
        if (r_farmer_id) r_farmer_id.value = '';
        if (r_reference_no) r_reference_no.value = 'Memo-' + Date.now().toString().slice(-4);
      } else if (type === 'RECEIVED') {
        registersCache.unshift(txPayload);
        if (r_received_qty) r_received_qty.value = '';
        if (r_reference_no) r_reference_no.value = 'Challan-' + Date.now().toString().slice(-4);
      } else {
        registersCache.unshift(txPayload);
      }
      showToast(`Saved ${type} entry for ${fertVal}!`);
      loadDealerRegisterTable();
      computeAndRenderDashboard();
      return;
    }

    try {
      let insertPayload = { ...txPayload };
      let res = await supabase.from('transactions').insert([insertPayload]).select().maybeSingle();
      if (res.error) {
        // If schema uses farmer_id instead of customer_id, adapt seamlessly
        if (res.error.message && res.error.message.includes('customer_id')) {
          delete insertPayload.customer_id;
          insertPayload.farmer_id = farmerId;
          res = await supabase.from('transactions').insert([insertPayload]).select().maybeSingle();
        }
        if (res.error) {
          const resAlt = await supabase.from('Transaction').insert([insertPayload]).select().maybeSingle();
          if (resAlt.error) throw res.error;
        }
      }

      txPayload.id = res.data?.id || ('tx-' + Date.now());
      txPayload.customer_id = farmerId;
      txPayload.farmer_id = farmerId;
      txPayload.register_serial_no = refNo;
      txPayload.quantity_kg = type === 'ISSUED' ? issQty : (recQty > 0 ? recQty : issQty);
      transactionsCache.unshift(txPayload);
      if (type === 'ISSUED') {
        salesCache.unshift(txPayload);
        if (r_issued_qty) r_issued_qty.value = '';
        if (r_farmer_id) r_farmer_id.value = '';
        if (r_reference_no) r_reference_no.value = 'Memo-' + Date.now().toString().slice(-4);
      } else if (type === 'RECEIVED') {
        registersCache.unshift(txPayload);
        if (r_received_qty) r_received_qty.value = '';
        if (r_reference_no) r_reference_no.value = 'Challan-' + Date.now().toString().slice(-4);
      } else {
        registersCache.unshift(txPayload);
      }
      showToast(`Saved ${type} entry for ${fertVal}!`);
      loadDealerRegisterTable();
      loadDashboardData();
    } catch (err) {
      showAlert('Error saving register entry: ' + err.message);
    }
  });
}

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

function formatDateDMY(dateInput) {
  if (!dateInput) return 'N/A';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
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
      <td style="color:var(--text-muted); font-size:0.85rem; font-weight:600;">${formatDateDMY(d.created_at)}</td>
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
// FORM: ADD CONTRIBUTOR (ADMIN ONLY) CONTROLLER
// ---------------------------------------------------------------------
const formContributor = document.getElementById('formContributor');
const allContributorsTableBody = document.getElementById('allContributorsTableBody');

async function loadContributorsTable() {
  if (!allContributorsTableBody) return;
  allContributorsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:18px;">Loading contributors...</td></tr>`;

  if (!isSupabaseConfigured) {
    renderContributorsTable(contributorsCache);
    return;
  }

  try {
    const { data, error } = await supabase.from('contributors').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    contributorsCache = data || [];
    renderContributorsTable(contributorsCache);
  } catch (err) {
    console.warn('Contributors fetch error:', err);
    if (err.message && err.message.includes('schema cache')) {
      allContributorsTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; color:#f59e0b; padding:18px;">
            ⚠️ <strong>Table 'contributors' not yet created in Supabase.</strong><br/>
            <small style="color:var(--text-muted);">Please run the SQL script in your Supabase SQL Editor. Showing local entries for now.</small>
          </td>
        </tr>
      `;
    } else {
      allContributorsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#f87171;">Failed to load contributors.</td></tr>`;
    }
    // Also render any local entries if present
    if (contributorsCache.length > 0) {
      renderContributorsTable(contributorsCache);
    }
  }
}

function renderContributorsTable(contributors) {
  if (!allContributorsTableBody) return;
  if (!contributors || contributors.length === 0) {
    allContributorsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:18px; color:var(--text-muted);">No contributors registered yet.</td></tr>`;
    return;
  }

  allContributorsTableBody.innerHTML = contributors.map(c => `
    <tr>
      <td><strong>${c.full_name}</strong></td>
      <td><code>${c.username}</code></td>
      <td><code>${c.password}</code></td>
      <td>${c.mobile || '-'}</td>
      <td>${c.designation || '-'}</td>
      <td style="color:var(--text-muted); font-size:0.85rem; font-weight:600;">${formatDateDMY(c.created_at)}</td>
    </tr>
  `).join('');
}

if (formContributor) {
  formContributor.addEventListener('submit', async (e) => {
    e.preventDefault();
    showAlert(null);

    const contribPayload = {
      full_name: document.getElementById('c_name').value.trim(),
      username: document.getElementById('c_username').value.trim(),
      password: document.getElementById('c_password').value.trim(),
      mobile: document.getElementById('c_mobile').value.trim() || null,
      designation: document.getElementById('c_designation').value.trim() || null
    };

    if (!isSupabaseConfigured) {
      contributorsCache.unshift({ id: 'c-' + Date.now(), created_at: new Date().toISOString(), ...contribPayload });
      showToast(`Contributor ${contribPayload.full_name} registered!`);
      formContributor.reset();
      loadContributorsTable();
      return;
    }

    try {
      const { data, error } = await supabase.from('contributors').insert([contribPayload]).select().single();
      if (error) {
        if (error.message.includes('schema cache') || error.code === 'PGRST205') {
          // Table doesn't exist yet on remote Supabase instance
          contributorsCache.unshift({ id: 'c-' + Date.now(), created_at: new Date().toISOString(), ...contribPayload });
          showAlert('Notice: Table "public.contributors" is not created in Supabase yet. Run the SQL script from supabase_setup.sql in your Supabase SQL Editor. Contributor registered in local session.', 'warning');
          showToast(`Contributor ${contribPayload.full_name} saved locally!`);
          formContributor.reset();
          renderContributorsTable(contributorsCache);
          return;
        }
        if (error.message.includes('username')) throw new Error('A contributor with this username already exists.');
        throw error;
      }

      showToast(`Contributor ${data.full_name} registered successfully!`);
      formContributor.reset();
      loadContributorsTable();
    } catch (err) {
      showAlert('Error registering contributor: ' + err.message);
    }
  });
}

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
    const isDealer = currentUser?.role === 'dealer' && isValidUUID(currentUser.dealer?.id);

    // Parallel fetch of all related data:
    // All dealers are allowed to view and select all registered farmers registered by all dealers
    const [farmersRes, dealersRes] = await Promise.all([
      supabase.from('farmers').select('*').order('farmer_name', { ascending: true }),
      supabase.from('dealers').select('*').order('dealer_name', { ascending: true })
    ]);

    farmersCache = farmersRes.data || [];
    dealersCache = dealersRes.data || [];

    // Fetch unified transactions (Dealer gets only their own transactions)
    let txData = [];
    let txQuery = supabase.from('transactions').select('*').order('created_at', { ascending: false });
    if (isDealer) {
      txQuery = txQuery.eq('dealer_id', currentUser.dealer.id);
    }
    const txRes = await txQuery;
    if (!txRes.error && txRes.data) {
      txData = txRes.data;
    } else {
      let txQueryAlt = supabase.from('Transaction').select('*').order('created_at', { ascending: false });
      if (isDealer) {
        txQueryAlt = txQueryAlt.eq('dealer_id', currentUser.dealer.id);
      }
      const txResAlt = await txQueryAlt;
      if (!txResAlt.error && txResAlt.data) {
        txData = txResAlt.data;
      }
    }

    // If dealer has transactions with a farmer registered before dealer_id association, fetch those farmers
    if (isDealer && txData.length > 0) {
      const neededFarmerIds = txData
        .map(t => t.customer_id || t.farmer_id)
        .filter(Boolean)
        .filter(id => !farmersCache.some(f => f.id === id));
      if (neededFarmerIds.length > 0) {
        const { data: missingFarmers } = await supabase.from('farmers').select('*').in('id', neededFarmerIds);
        if (missingFarmers && missingFarmers.length > 0) {
          farmersCache = [...farmersCache, ...missingFarmers];
        }
      }
    }

    transactionsCache = txData;
    salesCache = transactionsCache.filter(t => (t.transaction_type || '').toUpperCase() === 'ISSUED');
    registersCache = transactionsCache.filter(t => (t.transaction_type || '').toUpperCase() !== 'ISSUED');

    populateFilterOptions();
    computeAndRenderDashboard();
  } catch (err) {
    console.error('Error loading dashboard:', err);
    showToast('Failed to refresh dashboard data: ' + err.message, false);
  }
}

// Geographic Master Data (Strictly Ukhiya and its 5 Unions)
const UKHIYA_UPAZILAS = [
  "Ukhiya"
];

const UKHIYA_UNIONS = [
  "Raja Palong",
  "Jalia Palong",
  "Palong Khali",
  "Ratna Palong",
  "Holdia Palong"
];

function populateFilterOptions() {
  const isDealer = currentUser?.role === 'dealer' && isValidUUID(currentUser.dealer?.id);

  // Populate Dealer-wise filter (Accessible for Admin and Contributor only)
  if (filterDealer) {
    if (isDealer) {
      if (fg_filterDealer) fg_filterDealer.style.display = 'none';
    } else {
      if (fg_filterDealer) fg_filterDealer.style.display = 'block';
      const curSelected = filterDealer.value;
      filterDealer.innerHTML = '<option value="">All Dealers (Overall System)</option>' + 
        dealersCache.map(d => `<option value="${d.id}" ${d.id === curSelected ? 'selected' : ''}>${d.dealer_name} (Reg: ${d.registration_number}) - ${d.union_name}</option>`).join('');
    }
  }

  const selectedUpazila = filterUpazila ? (filterUpazila.value || '') : '';
  const selectedUnion = filterUnion ? (filterUnion.value || '') : '';

  if (filterUpazila) {
    filterUpazila.innerHTML = '<option value="">All Upazilas (Ukhiya)</option>' + 
      UKHIYA_UPAZILAS.map(u => `<option value="${u}" ${u === selectedUpazila ? 'selected' : ''}>${u}</option>`).join('');
    filterUpazila.disabled = false;
  }

  if (filterUnion) {
    filterUnion.innerHTML = '<option value="">All Unions (Ukhiya)</option>' + 
      UKHIYA_UNIONS.map(u => `<option value="${u}" ${u === selectedUnion ? 'selected' : ''}>${u}</option>`).join('');
    filterUnion.disabled = false;
  }
}

function computeAndRenderDashboard() {
  const isDealer = currentUser?.role === 'dealer' && isValidUUID(currentUser.dealer?.id);
  const selectedDealerId = !isDealer && filterDealer ? (filterDealer.value || '').trim() : '';
  const currentDealerId = isDealer ? currentUser.dealer.id : (selectedDealerId || null);
  const isFilteredToSpecificDealer = Boolean(currentDealerId);
  const isMatchDealerId = (id1, id2) => Boolean(id1 && id2 && String(id1).toLowerCase().trim() === String(id2).toLowerCase().trim());

  const selectedDealerObj = isFilteredToSpecificDealer
    ? (isDealer ? currentUser.dealer : dealersCache.find(d => isMatchDealerId(d.id, currentDealerId)))
    : null;

  // 1. Transactions & Sales strictly scoped to dealer when logged in as dealer OR when admin/contributor chooses a specific dealer
  const scopedTransactions = isFilteredToSpecificDealer
    ? transactionsCache.filter(tx => isMatchDealerId(tx.dealer_id, currentDealerId))
    : transactionsCache;

  const scopedSales = isFilteredToSpecificDealer
    ? salesCache.filter(s => isMatchDealerId(s.dealer_id, currentDealerId))
    : salesCache;

  // 2. Scope farmers:
  // Each dealer is allowed to view all registered farmers registered by all dealers.
  // When an Admin explicitly chooses a dealer in the filter, scope to that dealer; otherwise show all registered farmers.
  const scopedFarmers = (!isDealer && selectedDealerId)
    ? farmersCache.filter(f => isMatchDealerId(f.dealer_id, selectedDealerId))
    : farmersCache;

  const upazilaVal = (filterUpazila.value || '').toLowerCase().trim();
  const unionVal = (filterUnion.value || '').toLowerCase().trim();
  const blockVal = filterBlock.value.trim();
  const wardVal = filterWard.value.toLowerCase().trim();

  const startDateVal = filterStartDate?.value || '';
  const endDateVal = filterEndDate?.value || '';

  // Filter Farmers by geographic selection
  const matchingFarmers = scopedFarmers.filter(f => {
    if (upazilaVal && (f.upazila || '').toLowerCase() !== upazilaVal) return false;
    if (unionVal) {
      const u1 = (f.union_name || '').toLowerCase().replace(/\s+/g, '');
      const u2 = unionVal.toLowerCase().replace(/\s+/g, '');
      if (u1 !== u2 && !(f.union_name || '').toLowerCase().includes(unionVal)) return false;
    }
    if (blockVal && String(f.block) !== blockVal) return false;
    if (wardVal && !(f.ward || '').toLowerCase().includes(wardVal)) return false;
    return true;
  });

  const matchingFarmerIds = new Set(matchingFarmers.map(f => f.id));

  // Filter Sales to matching farmers and date range (scoped to dealer)
  const filteredSales = scopedSales.filter(s => {
    // If geo filter is applied, farmer must match
    if (blockVal || wardVal) {
      const fId = s.customer_id || s.farmer_id;
      if (!matchingFarmerIds.has(fId)) return false;
    }
    // Date filter
    const sDate = s.transaction_date || s.sale_date || '';
    if (startDateVal && sDate < startDateVal) return false;
    if (endDateVal && sDate > endDateVal) return false;
    return true;
  });

  // Dynamic titles and labels based on active dealer context
  if (isFilteredToSpecificDealer && selectedDealerObj) {
    if (metricFarmerLabel) metricFarmerLabel.textContent = "Dealer's Farmers Served";
    if (metricSoldLabel) metricSoldLabel.textContent = "Dealer's Fertilizer Sold";
    if (metricStockLabel) metricStockLabel.textContent = "Dealer's Store Closing Stock";

    if (metricFarmerDesc) metricFarmerDesc.textContent = `Unique farmers served by ${selectedDealerObj.dealer_name}`;
    if (metricSoldDesc) metricSoldDesc.textContent = `Fertilizer sold by ${selectedDealerObj.dealer_name}`;
    if (metricStockDesc) metricStockDesc.textContent = `Available stock in ${selectedDealerObj.dealer_name}`;

    if (fertilizerTableTitle) fertilizerTableTitle.textContent = `🧪 ${selectedDealerObj.dealer_name} Stock Breakdown: Urea • TSP • MoP • DAP`;
    if (summaryReportTitle) summaryReportTitle.textContent = `📈 ${selectedDealerObj.dealer_name} Stock & Sales Summary Report`;
    if (recentSalesTitle) recentSalesTitle.textContent = `📋 Recent Sales Records (${selectedDealerObj.dealer_name})`;
    if (farmersDirectoryTitle) {
      farmersDirectoryTitle.textContent = isDealer 
        ? "👨‍🌾 Registered Farmers Directory (All Registered Farmers)"
        : `👨‍🌾 Farmers Registered by ${selectedDealerObj.dealer_name}`;
    }
  } else if (!isDealer) {
    if (metricFarmerLabel) metricFarmerLabel.textContent = "Farmers Received Fertilizer";
    if (metricSoldLabel) metricSoldLabel.textContent = "Total Fertilizer Sold";
    if (metricStockLabel) metricStockLabel.textContent = "Total Stock Status (All Dealers)";

    if (metricFarmerDesc) metricFarmerDesc.textContent = 'Total unique farmers with fertilizer purchases';
    if (metricSoldDesc) metricSoldDesc.textContent = 'Total fertilizer distributed across dealers (in kg)';
    if (metricStockDesc) metricStockDesc.textContent = 'Available fertilizer across all registered dealers';

    if (fertilizerTableTitle) fertilizerTableTitle.textContent = '🧪 Total Fertilizer Breakdown Across All Dealers: Urea • TSP • MoP • DAP';
    if (summaryReportTitle) summaryReportTitle.textContent = '📈 All Dealers Fertilizer Distribution & Stock Summary Report';
    if (recentSalesTitle) recentSalesTitle.textContent = '📋 Recent Sales Records (All Dealers)';
    if (farmersDirectoryTitle) farmersDirectoryTitle.textContent = '👨‍🌾 Registered Farmers Directory';
  }

  // KPI 1: Number of Farmer received fertilizer from this dealer
  const farmersReceivedSet = new Set(filteredSales.map(s => s.customer_id || s.farmer_id).filter(Boolean));
  metricFarmerCount.textContent = farmersReceivedSet.size;

  // KPI 2: Quantity (kg) of fertilizer sold / issued by this dealer
  const totalSoldKg = filteredSales.reduce((sum, s) => sum + (parseFloat(s.issued_qty) || parseFloat(s.quantity_kg) || 0), 0);
  metricSoldKg.innerHTML = `${totalSoldKg.toLocaleString()} <span style="font-size: 1.1rem; font-weight: 500;">kg</span>`;

  // 3. Compute Stock Status strictly for this dealer (Closing Stock = Opening Stock + Received - Issued)
  const fertilizerTypes = ['Urea', 'TSP', 'MoP', 'DAP'];
  const breakdown = {};

  fertilizerTypes.forEach(ft => {
    breakdown[ft] = { opening: 0, received: 0, sold: 0, closing: 0 };
  });

  // Calculate across scoped transactions
  scopedTransactions.forEach(tx => {
    const ft = tx.fertilizer_name;
    if (breakdown[ft]) {
      const type = (tx.transaction_type || tx.status_type || (tx.sale_date ? 'ISSUED' : 'OPENING')).toUpperCase();
      let recQty = parseFloat(tx.received_qty) || 0;
      let issQty = parseFloat(tx.issued_qty) || 0;
      const qty = parseFloat(tx.quantity_kg) || 0;

      if (recQty === 0 && issQty === 0 && qty > 0) {
        if (type.includes('OPEN') || type.includes('REC')) recQty = qty;
        else if (type.includes('ISS') || type.includes('SALE')) issQty = qty;
      }

      if (type.includes('OPEN')) {
        breakdown[ft].opening += recQty;
      } else if (type.includes('REC')) {
        breakdown[ft].received += recQty;
      } else if (type.includes('ISS') || type.includes('SALE')) {
        breakdown[ft].sold += issQty;
      }
    }
  });

  // Formula: Closing Stock = Opening Stock + Received - Issued
  let totalStockKg = 0;
  fertilizerTypes.forEach(ft => {
    const item = breakdown[ft];
    item.closing = item.opening + item.received - item.sold;
    totalStockKg += item.closing;
  });

  metricStockKg.innerHTML = `${totalStockKg.toLocaleString()} <span style="font-size: 1.1rem; font-weight: 500;">kg</span>`;

  // Render Fertilizer Breakdown Table
  fertilizerStatsBody.innerHTML = fertilizerTypes.map(ft => {
    const item = breakdown[ft];
    return `
      <tr>
        <td><strong>${ft}</strong></td>
        <td>${item.opening.toLocaleString()} kg</td>
        <td style="color:#34d399; font-weight:600;">+${item.received.toLocaleString()} kg</td>
        <td style="color:#f87171; font-weight:600;">-${item.sold.toLocaleString()} kg</td>
        <td><strong style="color:${item.closing >= 0 ? '#60a5fa' : '#f87171'}; font-size:1.02rem;">${item.closing.toLocaleString()} kg</strong></td>
      </tr>
    `;
  }).join('');

  // Render Recent Sales Table & Cache for export (filtered to dealer)
  currentFilteredSalesData = filteredSales.map(s => {
    const fId = s.customer_id || s.farmer_id;
    const farmerObj = s.farmers || farmersCache.find(f => f.id === fId);
    return {
      date: s.transaction_date || s.sale_date || 'N/A',
      serial: s.reference_no || s.register_serial_no || 'N/A',
      farmerName: s.customer || farmerObj?.farmer_name || 'Registered Farmer',
      farmerLocation: farmerObj ? `${farmerObj.village}, Ward ${farmerObj.ward}, Block ${farmerObj.block}, ${farmerObj.union_name}` : 'N/A',
      fertilizer: s.fertilizer_name,
      quantityKg: parseFloat(s.issued_qty) || parseFloat(s.quantity_kg) || 0
    };
  });

  if (filteredSales.length === 0) {
    recentSalesTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">No sales records found matching the filter.</td></tr>`;
  } else {
    recentSalesTableBody.innerHTML = filteredSales.slice(0, 25).map(s => {
      const fId = s.customer_id || s.farmer_id;
      const farmerObj = s.farmers || farmersCache.find(f => f.id === fId);
      const farmerName = s.customer || farmerObj?.farmer_name || 'Registered Farmer';
      const farmerLoc = farmerObj ? `${farmerObj.village}, Ward ${farmerObj.ward}` : 'N/A';
      const saleDate = s.transaction_date || s.sale_date || 'N/A';
      const refNo = s.reference_no || s.register_serial_no || 'N/A';
      const qty = parseFloat(s.issued_qty) || parseFloat(s.quantity_kg) || 0;

      return `
        <tr>
          <td>${saleDate}</td>
          <td><code>${refNo}</code></td>
          <td><strong>${farmerName}</strong></td>
          <td style="color:var(--text-muted); font-size:0.82rem;">${farmerLoc}</td>
          <td><span class="user-role-pill" style="background:#047857;">${s.fertilizer_name}</span></td>
          <td><strong>${qty.toLocaleString()}</strong> kg</td>
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

      const regDealer = dealersCache.find(d => isMatchDealerId(d.id, f.dealer_id));
      const dealerTag = regDealer 
        ? `<div style="font-size:0.75rem; color:#93c5fd; margin-top:2px;">Reg by: ${regDealer.dealer_name}</div>` 
        : '';

      return `
        <tr>
          <td>
            <strong>${f.farmer_name}</strong>
            ${dealerTag}
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

  const isDealer = currentUser?.role === 'dealer' && isValidUUID(currentUser.dealer?.id);
  const selectedDealerId = !isDealer && filterDealer ? (filterDealer.value || '').trim() : '';
  const currentDealerId = isDealer ? currentUser.dealer.id : (selectedDealerId || null);
  const isFilteredToSpecificDealer = Boolean(currentDealerId);
  const isMatchDealerId = (id1, id2) => Boolean(id1 && id2 && String(id1).toLowerCase().trim() === String(id2).toLowerCase().trim());

  const selectedDealerObj = isFilteredToSpecificDealer
    ? (isDealer ? currentUser.dealer : dealersCache.find(d => isMatchDealerId(d.id, currentDealerId)))
    : null;

  const scopedTransactions = isFilteredToSpecificDealer
    ? transactionsCache.filter(tx => isMatchDealerId(tx.dealer_id, currentDealerId))
    : transactionsCache;

  // Calculate stock balance per dealer from transactions
  // dealerStockMap: dealerId => { opening: kg, received: kg, sold: kg }
  const dealerStockMap = new Map();
  if (isFilteredToSpecificDealer) {
    dealerStockMap.set(currentDealerId, { opening: 0, received: 0, sold: 0 });
  } else {
    dealersCache.forEach(d => {
      dealerStockMap.set(d.id, { opening: 0, received: 0, sold: 0 });
    });
  }

  scopedTransactions.forEach(tx => {
    const entry = dealerStockMap.get(isFilteredToSpecificDealer ? currentDealerId : tx.dealer_id);
    if (entry) {
      const type = (tx.transaction_type || tx.status_type || (tx.sale_date ? 'ISSUED' : 'OPENING')).toUpperCase();
      let recQty = parseFloat(tx.received_qty) || 0;
      let issQty = parseFloat(tx.issued_qty) || 0;
      const qty = parseFloat(tx.quantity_kg) || 0;

      if (recQty === 0 && issQty === 0 && qty > 0) {
        if (type.includes('OPEN') || type.includes('REC')) recQty = qty;
        else if (type.includes('ISS') || type.includes('SALE')) issQty = qty;
      }

      if (type.includes('OPEN')) entry.opening += recQty;
      else if (type.includes('REC')) entry.received += recQty;
      else if (type.includes('ISS') || type.includes('SALE')) entry.sold += issQty;
    }
  });

  // Aggregation bucket
  // key => { groupLabel, union, block, ward, date, farmersSet: Set, soldKg, dealersSet: Set }
  const groups = new Map();

  filteredSales.forEach(s => {
    const farmer = s.farmers || farmerMap.get(s.farmer_id || s.customer_id) || {};
    const u = farmer.union_name || 'Unknown Union';
    const b = farmer.block ? `Block ${farmer.block}` : 'N/A';
    const w = farmer.ward ? `Ward ${farmer.ward}` : 'N/A';
    const d = s.transaction_date || s.sale_date || 'N/A';

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
    const fId = s.customer_id || s.farmer_id;
    if (fId) row.farmersSet.add(fId);
    row.soldKg += parseFloat(s.issued_qty) || parseFloat(s.quantity_kg) || 0;
    if (s.dealer_id) row.dealersSet.add(s.dealer_id);
  });

  // Transform to structured array with Formula: Closing Stock = Opening Stock + Received - Issued
  currentSummaryData = Array.from(groups.values()).map(g => {
    let openingStock = 0;
    let receivedStock = 0;
    let soldAcrossDealers = 0;

    if (isFilteredToSpecificDealer) {
      const dStock = dealerStockMap.get(currentDealerId);
      if (dStock) {
        openingStock = dStock.opening;
        receivedStock = dStock.received;
        soldAcrossDealers = dStock.sold;
      }
    } else {
      g.dealersSet.forEach(dId => {
        const dStock = dealerStockMap.get(dId);
        if (dStock) {
          openingStock += dStock.opening;
          receivedStock += dStock.received;
          soldAcrossDealers += dStock.sold;
        }
      });
    }

    const finalSold = g.soldKg || soldAcrossDealers;
    // Formula: Closing Stock = Opening Stock + Received - Issued
    const closingStock = openingStock + receivedStock - finalSold;

    return {
      groupLabel: g.groupLabel,
      date: g.date,
      union: g.union,
      block: g.block,
      ward: g.ward,
      farmerCount: g.farmersSet.size,
      soldKg: finalSold,
      openingStock,
      receivedStock,
      closingStock
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

  summaryTableBody.innerHTML = currentSummaryData.map(row => {
    return `
      <tr>
        <td><strong>${row.groupLabel}</strong></td>
        <td><code>${row.date}</code></td>
        <td>${row.union}</td>
        <td>${row.block}</td>
        <td>${row.ward}</td>
        <td style="text-align: right;"><span class="user-role-pill" style="background:#2563eb;">${row.farmerCount}</span></td>
        <td style="text-align: right;">${row.openingStock.toLocaleString()} kg</td>
        <td style="text-align: right; color:#34d399; font-weight:600;">+${row.receivedStock.toLocaleString()} kg</td>
        <td style="text-align: right; color:#f87171; font-weight:600;">-${row.soldKg.toLocaleString()} kg</td>
        <td style="text-align: right; font-weight:700; color:#60a5fa;">${row.closingStock.toLocaleString()} kg</td>
      </tr>
    `;
  }).join('');

  // Table Footer Totals: calculate exact store totals rather than summing repeated rows
  let totalOpening = 0;
  let totalReceived = 0;
  let totalSold = 0;
  let totalClosing = 0;

  if (isFilteredToSpecificDealer) {
    const dStock = dealerStockMap.get(currentDealerId) || { opening: 0, received: 0, sold: 0 };
    totalOpening = dStock.opening;
    totalReceived = dStock.received;
    totalSold = filteredSales.reduce((sum, s) => sum + (parseFloat(s.issued_qty) || parseFloat(s.quantity_kg) || 0), 0);
    totalClosing = totalOpening + totalReceived - totalSold;
  } else {
    dealerStockMap.forEach(dStock => {
      totalOpening += dStock.opening;
      totalReceived += dStock.received;
    });
    totalSold = filteredSales.reduce((sum, s) => sum + (parseFloat(s.issued_qty) || parseFloat(s.quantity_kg) || 0), 0);
    totalClosing = totalOpening + totalReceived - totalSold;
  }

  const uniqueFarmersCount = new Set(filteredSales.map(s => s.customer_id || s.farmer_id).filter(Boolean)).size;

  const footerTitle = isFilteredToSpecificDealer 
    ? `<strong>${(selectedDealerObj?.dealer_name || 'DEALERSHIP').toUpperCase()} STORE TOTALS</strong>`
    : `<strong>ALL DEALERS SUMMARY TOTALS</strong>`;

  summaryTableFoot.innerHTML = `
    <tr>
      <td colspan="5" style="padding: 12px 14px;">${footerTitle}</td>
      <td style="text-align: right;"><span class="user-role-pill" style="background:#1d4ed8;">${uniqueFarmersCount}</span></td>
      <td style="text-align: right;">${totalOpening.toLocaleString()} kg</td>
      <td style="text-align: right; color:#34d399; font-size:1.05rem;">+${totalReceived.toLocaleString()} kg</td>
      <td style="text-align: right; color:#f87171; font-size:1.05rem;">-${totalSold.toLocaleString()} kg</td>
      <td style="text-align: right; color:#60a5fa; font-size:1.05rem; font-weight:800;">${totalClosing.toLocaleString()} kg</td>
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
      'Opening Stock (kg)': r.openingStock,
      'Received Stock (kg)': r.receivedStock,
      'Fertilizer Sold / Issued (kg)': r.soldKg,
      'Closing Stock (kg)': r.closingStock
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
      ['SL', 'Group', 'Date', 'Union', 'Block', 'Ward', 'Farmers', 'Opening (kg)', 'Received (kg)', 'Sold/Issued (kg)', 'Closing Stock (kg)']
    ];

    const body = currentSummaryData.map((r, i) => [
      i + 1,
      r.groupLabel,
      r.date,
      r.union,
      r.block,
      r.ward,
      r.farmerCount,
      r.openingStock.toLocaleString(),
      r.receivedStock.toLocaleString(),
      r.soldKg.toLocaleString(),
      r.closingStock.toLocaleString()
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
[filterDealer, filterUpazila, filterUnion, filterBlock].filter(Boolean).forEach(el => el.addEventListener('change', computeAndRenderDashboard));
filterWard.addEventListener('input', computeAndRenderDashboard);
if (filterStartDate) filterStartDate.addEventListener('change', computeAndRenderDashboard);
if (filterEndDate) filterEndDate.addEventListener('change', computeAndRenderDashboard);
if (searchFarmerInput) {
  searchFarmerInput.addEventListener('input', computeAndRenderDashboard);
}

btnResetFilters.addEventListener('click', () => {
  const isDealer = currentUser?.role === 'dealer' && isValidUUID(currentUser.dealer?.id);
  if (isDealer) {
    filterUpazila.value = currentUser.dealer.upazila || '';
    filterUnion.value = currentUser.dealer.union_name || '';
  } else {
    filterUpazila.value = '';
    filterUnion.value = '';
    if (filterDealer) filterDealer.value = '';
  }
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

