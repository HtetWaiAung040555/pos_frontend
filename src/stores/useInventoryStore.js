import { defineStore } from "pinia";
import axios from "axios";
import { normalizeApiError } from "@/utils/NormalizeApiError";

export const useInventoryStore = defineStore('Inventory', {
    state: () => ({
        stockList: [],
        loading: false,
        error: [],
        data: [],
        deleteLoading: false
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
        async addStock(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/inventories`, formData);
                console.log(response);
                this.stockList = response.data.data;
                console.log(response);
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
                console.log(formData);
                const response = await axios.put(`/inventories/${id}`, formData);
                this.stockList = response.data.data;
                console.log(response);
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