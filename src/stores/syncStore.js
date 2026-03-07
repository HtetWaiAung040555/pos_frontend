import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "@/utils/config";
import { normalizeApiError } from "@/utils/NormalizeApiError";

const api_url = API_URL;

export const useSyncStore = defineStore('Sync Store', {
    state: () => ({
        dataList: null,
        loading: false,
        deleteLoading: false,
        data: null,
        error: [],
    }),

    actions: {
        async syncAll(formData, onProgress = () => {}) {
            this.loading = true;
            this.error = [];
            try {
                onProgress({ progress: 12, status: 'Syncing warehouses...' });
                await axios.post(`/warehouses`, formData);
                onProgress({ progress: 24, status: 'Syncing branches...' });
                await axios.post(`/branches`, formData);
                onProgress({ progress: 36, status: 'Syncing counters...' });
                await axios.post(`/counters`, formData);
                onProgress({ progress: 48, status: 'Syncing user roles...' });
                await axios.post(`/roles`, formData);
                onProgress({ progress: 60, status: 'Syncing users...' });
                await axios.post(`/users/sync`, formData);
                onProgress({ progress: 72, status: 'Syncing units...' });
                await axios.post(`/units`, formData); 
                onProgress({ progress: 84, status: 'Syncing categories...' });
                await axios.post(`/categories`, formData); 
                onProgress({ progress: 96, status: 'Syncing payment methods...' });
                await axios.post(`/payment_methods`, formData);
                onProgress({ progress: 100, status: 'Sync completed.' });
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async syncToCloud(formData, onProgress = () => {}) {

            this.loading = true;
            this.error = [];

            try {

                onProgress?.({ progress: 15, status: 'Syncing wallets...' });
                await axios.post('/wallets/sync_to_cloud', formData);

                onProgress?.({ progress: 35, status: 'Syncing sales...' });
                await axios.post('/sales/sync_to_cloud', formData);

                onProgress?.({ progress: 55, status: 'Downloading updated data...' });

                const [customers, products, inventories, promotions] = await Promise.all([
                    axios.post('/customers/sync', formData),
                    axios.post('/products/sync', formData),
                    axios.post('/inventories/sync', formData),
                    axios.post('/promotions/sync', formData)
                ]);

                onProgress?.({ progress: 100, status: 'Sync completed.' });

                return {
                    customers: customers.data,
                    products: products.data,
                    inventories: inventories.data,
                    promotions: promotions.data
                };

            } catch (err) {

                const message =
                    err.response?.data?.error ||
                    err.response?.data?.message ||
                    err.message ||
                    'Cloud sync failed';

                this.error = [message];

                throw new Error(message);

            } finally {

                this.loading = false;

            }
        }
    }
});