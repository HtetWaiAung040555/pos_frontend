import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createRouter, createWebHistory } from 'vue-router';
import Home from './views/Home.vue';
import POS from './views/POS/POS.vue';
import Login from './components/Login.vue';
import Register from './components/Register.vue';
import { createPinia } from 'pinia';
import '@fortawesome/fontawesome-free/css/all.css';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import 'primeicons/primeicons.css';
import Branch from './views/Branch/Branch.vue';
import CreateBranch from './views/Branch/CreateBranch.vue';
import UpdateBranch from './views/Branch/UpdateBranch.vue';
import ToastService from 'primevue/toastservice';
import { useUserStore } from './stores/useUserStore';
import { API_URL } from './utils/config';
import axios from "axios";
import Role from './views/User_Role/Role.vue';
import CreateRole from './views/User_Role/CreateRole.vue';
import UpdateRole from './views/User_Role/UpdateRole.vue';
import Unauthorized from './views/Unauthorized.vue';
import User from './views/User/User.vue';
import CreateUser from './views/User/CreateUser.vue';
import UpdateUser from './views/User/UpdateUser.vue';
import Counter from './views/Counter/Counter.vue';
import CreateCounter from './views/Counter/CreateCounter.vue';
import UpdateCounter from './views/Counter/UpdateCounter.vue';
import Receipt from './views/POS/Receipt.vue';
import Product from './views/Product/Product.vue';
import CreateProduct from './views/Product/CreateProduct.vue';
import UpdateProduct from './views/Product/UpdateProduct.vue';
import Inventory from './views/Inventory/Inventory.vue';
import CreateInventory from './views/Inventory/CreateInventory.vue';
import UpdateInventory from './views/Inventory/UpdateInventory.vue';
import Customer from './views/Customer/Customer.vue';
import CreateCustomer from './views/Customer/CreateCustomer.vue';
import CreatePayment from './views/POS/CreatePayment.vue';
import UpdateWarehouse from './views/Warehouse/UpdateWarehouse.vue';
import CreateWarehouse from './views/Warehouse/CreateWarehouse.vue';
import Warehouse from './views/Warehouse/Warehouse.vue';
import PaymentMethod from './views/Payment_Method/PaymentMethod.vue';
import CreatePaymentMethod from './views/Payment_Method/CreatePaymentMethod.vue';
import UpdatePaymentMethod from './views/Payment_Method/UpdatePaymentMethod.vue';
import Category from './views/Category/Category.vue';
import CreateCategory from './views/Category/CreateCategory.vue';
import UpdateCategory from './views/Category/UpdateCategory.vue';
import Sales from './views/Sales/Sales.vue';
import UpdateCustomer from './views/Customer/UpdateCustomer.vue';
import Wallet from './views/Wallet/Wallet.vue';
import CreateWalletTopUp from './views/Wallet/CreateWalletTopUp.vue';
import UpdateWalletTopUp from './views/Wallet/UpdateWalletTopUp.vue';
import Promotion from './views/promotion/Promotion.vue';
import CreatePromotion from './views/promotion/CreatePromotion.vue';
import UpdatePromotion from './views/promotion/UpdatePromotion.vue';




const router = createRouter({
    history: createWebHistory(),
    routes: [
        {path: '/login', name: 'Login', component: Login},
        {path: '/register', name: 'Register', component: Register},
        {path: '/unauthorized', name: 'Unauthorized', component: Unauthorized},
        {path: '/', name: 'Home', component: Home, meta: { requiresAuth: true }},
        {path: '/pos', name: 'POS', component: POS, meta: { requiresAuth: true, permission: { resource: 'POS', action: 'View' } }},
        {path: '/user', name: 'Users', component: User, meta: { requiresAuth: true, permission: { resource: 'User', action: 'View' }  }},
        {path: '/user/create', name: 'Create User', component: CreateUser, meta: { requiresAuth: true, permission: { resource: 'User', action: 'Create' } }},
        {path: '/user/update', name: 'Update User', component: UpdateUser, meta: { requiresAuth: true, permission: { resource: 'User', action: 'Update' } }},
        {path: '/branch', name: 'Branch', component: Branch, meta: { requiresAuth: true, permission: { resource: 'Branch', action: 'View' } }},
        {path: '/branch/create', name: 'Create Branch', component: CreateBranch, meta: { requiresAuth: true, permission: { resource: 'Branch', action: 'Create' } }},
        {path: '/branch/update', name: 'Update Branch', component: UpdateBranch, meta: { requiresAuth: true, permission: { resource: 'Branch', action: 'Update' } }},
        {path: '/role', name: 'Role', component: Role, meta: { requiresAuth: true, permission: { resource: 'Role', action: 'View' } }},
        {path: '/role/create', name: 'Create Role', component: CreateRole, meta: { requiresAuth: true, permission: { resource: 'Role', action: 'Create' } }},
        {path: '/role/update', name: 'Update Role', component: UpdateRole, meta: { requiresAuth: true, permission: { resource: 'Role', action: 'Update' } }},
        {path: '/counter', name: 'Counter', component: Counter, meta: { requiresAuth: true, permission: { resource: 'Counter', action: 'View' } }},
        {path: '/counter/create', name: 'Create Counter', component: CreateCounter, meta: { requiresAuth: true, permission: { resource: 'Counter', action: 'Create' } }},
        {path: '/counter/update', name: 'Update Counter', component: UpdateCounter, meta: { requiresAuth: true, permission: { resource: 'Counter', action: 'Update' } }},
        {path: '/receipt', name: 'Receipt', component: Receipt, meta: { requiresAuth: true }},
        {path: '/product', name: 'Product', component: Product, meta: { requiresAuth: true, permission: { resource: 'Product', action: 'View' } }},
        {path: '/product/create', name: 'Create Product', component: CreateProduct, meta: { requiresAuth: true, permission: { resource: 'Product', action: 'Create' } }},
        {path: '/product/update', name: 'Update Product', component: UpdateProduct, meta: { requiresAuth: true, permission: { resource: 'Product', action: 'Update' } }},
        {path: '/inventory', name: 'Inventory', component: Inventory, meta: { requiresAuth: true, permission: { resource: 'Inventory', action: 'View' } }},
        {path: '/inventory/create', name: 'Create Inventory', component: CreateInventory, meta: { requiresAuth: true, permission: { resource: 'Inventory', action: 'Create' } }},
        {path: '/inventory/update', name: 'Update Inventory', component: UpdateInventory, meta: { requiresAuth: true, permission: { resource: 'Inventory', action: 'Update' } }},
        {path: '/customer', name: 'Customer', component: Customer, meta: { requiresAuth: true, permission: { resource: 'Customer', action: 'View' } }},
        {path: '/customer/create', name: 'Create Customer', component: CreateCustomer, meta: { requiresAuth: true, permission: { resource: 'Customer', action: 'Create' } }},
        {path: '/customer/update', name: 'Update Customer', component: UpdateCustomer, meta: { requiresAuth: true, permission: { resource: 'Customer', action: 'Update' } }},
        {path: '/payment/create', name: 'Create Payment', component: CreatePayment, meta: { requiresAuth: true, permission: { resource: 'POS', action: 'View' } }},
        {path: '/payment_method', name: 'Payment Method', component: PaymentMethod, meta: { requiresAuth: true, permission: { resource: 'Payment method', action: 'View' } }},
        {path: '/payment_method/create', name: 'Create Payment Method', component: CreatePaymentMethod, meta: { requiresAuth: true, permission: { resource: 'Payment method', action: 'Create' } }},
        {path: '/payment_method/update', name: 'Update Payment Method', component: UpdatePaymentMethod, meta: { requiresAuth: true, permission: { resource: 'Payment method', action: 'Update' } }},
        {path: '/warehouse', name: 'Warehouse', component: Warehouse, meta: { requiresAuth: true, permission: { resource: 'Warehouse', action: 'View' } }},
        {path: '/warehouse/create', name: 'Create Warehouse', component: CreateWarehouse, meta: { requiresAuth: true, permission: { resource: 'Warehouse', action: 'Create' } }},
        {path: '/warehouse/update', name: 'Update Warehouse', component: UpdateWarehouse, meta: { requiresAuth: true, permission: { resource: 'Warehouse', action: 'Update' } }},
        {path: '/sales', name: 'Sales', component: Sales, meta: { requiresAuth: true, permission: { resource: 'Sales', action: 'View' } }},
        {path: '/sales', name: 'Update Sales', component: Sales, meta: { requiresAuth: true, permission: { resource: 'Sales', action: 'View' } }},
        {path: '/category', name: 'Category', component: Category, meta: { requiresAuth: true, permission: { resource: 'Category', action: 'View' } }},
        {path: '/category/create', name: 'Create Category', component: CreateCategory, meta: { requiresAuth: true, permission: { resource: 'Category', action: 'Create' } }},
        {path: '/category/update', name: 'Update Category', component: UpdateCategory, meta: { requiresAuth: true, permission: { resource: 'Category', action: 'Update' } }},
        {path: '/wallet', name: 'Wallet', component: Wallet, meta: { requiresAuth: true, permission: { resource: 'Wallet', action: 'View' } }},
        {path: '/wallet/createTopUp', name: 'Create Wallet Top Up', component: CreateWalletTopUp, meta: { requiresAuth: true, permission: { resource: 'Wallet', action: 'Create' } }},
        {path: '/wallet/updateTopUp', name: 'Update Wallet Top Up', component: UpdateWalletTopUp, meta: { requiresAuth: true, permission: { resource: 'Wallet', action: 'Update' } }},
        {path: '/promotion', name: 'Promotion', component: Promotion, meta: { requiresAuth: true, permission: { resource: 'Promotion', action: 'View' } }},
        {path: '/promotion/create', name: 'Create Promotion', component: CreatePromotion, meta: { requiresAuth: true, permission: { resource: 'Promotion', action: 'Create' } }},
        {path: '/promotion/update', name: 'Update Promotion', component: UpdatePromotion, meta: { requiresAuth: true, permission: { resource: 'Promotion', action: 'Update' } }},
        { path: '/', redirect: '/login' }
    ]
});

// -----------------------------
// Axios Interceptor
// -----------------------------
axios.defaults.baseURL = API_URL;

// Attach token to requests
axios.interceptors.request.use((config) => {
    const userStore = useUserStore();
    if (userStore.token) {
        config.headers.Authorization = `Bearer ${userStore.token}`;
    }
    return config;
}, (error) => Promise.reject(error));

router.beforeEach((to, from, next) => {
    const useUser = useUserStore();
    if (to.meta.requiresAuth && !useUser.isAuthenticated) {
        return next('/login');
    } 
    if (to.meta.permission) {
        const {resource, action} = to.meta.permission;
        const user = JSON.parse(localStorage.getItem('user'));
        const hasPermission = user.permissions?.some(
            (p) => p.name === resource && p.action === action
        );
        if(!hasPermission) {
            return next('/unauthorized')
        }
    }
    next();
});

const app = createApp(App)
app.use(createPinia());
app.use(router);
app.use(PrimeVue, {
    theme: {
        preset: Aura,
    }
});
app.use(ToastService);
app.mount('#app');
