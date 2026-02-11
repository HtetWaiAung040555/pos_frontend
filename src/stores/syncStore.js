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
        async syncAll(formData) {
            this.loading = true;
            this.error = [];
            try {
                await axios.post(`/warehouses`, formData);
                await axios.post(`/branches`, formData);
                await axios.post(`/counters`, formData);
                await axios.post(`/roles`, formData);
                await axios.post(`/users/sync`, formData);
                await axios.post(`/units`, formData); 
                await axios.post(`/categories`, formData); 
                await axios.post(`/payment_methods`, formData);
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
    }
});