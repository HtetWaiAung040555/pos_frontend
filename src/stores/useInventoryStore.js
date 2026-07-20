import { defineStore } from "pinia";
import axios from "axios";
import { normalizeApiError } from "@/utils/NormalizeApiError";

export const useInventoryStore = defineStore('Inventory', {
    state: () => ({
        stockList: [],
        loading: false,
        error: [],
        data: [],
        deleteLoading: false,
        focAvailabilityList: [],
        focAvailabilityLoading: false,
        focAvailabilityError: [],
    }),

    actions: {
        async fetchAllStock() {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/inventories`);
                this.stockList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchStock(id) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/inventories/${id}`);
                this.stockList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchFocAvailability(payload) {
            this.focAvailabilityLoading = true;
            this.focAvailabilityError = [];
            try {
                const response = await axios.post(`/inventory/foc-availability`, payload);
                const availability = Array.isArray(response.data?.data) ? response.data.data : [];
                this.focAvailabilityList = availability;
                return availability;
            } catch (err) {
                this.focAvailabilityError = normalizeApiError(err);
                return null;
            } finally {
                this.focAvailabilityLoading = false;
            }
        },
        async addStock(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/inventories`, formData);
                this.stockList = response.data.data;
            } catch (err) {
               this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editStock(formData, id) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.put(`/inventories/${id}`, formData);
                this.stockList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async adjustStock(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/inventories/adjust`, formData);
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deleteStock(id) {
            this.deleteLoading = true;
            this.error = [];
            try {
                const response = await axios.delete(`/inventories/${id}`);
                this.data = response;
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data;
                } else if (err.response && err.response.status === 400) {
                    this.error = err.response.data.error;
                }
            } finally {
                this.deleteLoading = false;
            }
        },
    }
});
