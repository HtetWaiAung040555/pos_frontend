import { defineStore } from "pinia";
import axios from "axios";

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
            try {
                const response = await axios.get(`/inventories`);
                this.stockList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async fetchStock(id) {
            this.loading = true;
            try {
                const response = await axios.get(`/inventories/${id}`);
                this.stockList = response.data.data;
            } catch (err) {
                this.error = err.message
            } finally {
                this.loading = false;
            }
        },
        async addStock(formData) {
            this.loading = true;
            try {
                const response = await axios.post(`/inventories`, formData);
                this.stockList = response.data.data;
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
            } finally {
                this.loading = false;
            }
        },
        async editStock(formData, id) {
            this.loading = true;
            try {
                const response = await axios.put(`/inventories/${id}`, formData);
                this.stockList = response.data.data;
                console.log(response);
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    // Custom error message
                    this.error = err.response.data.error;
                }
            } finally {
                this.loading = false;
            }
        },
        async adjustStock(formData) {
            this.loading = true;
            try {
                console.log(formData);
                const response = await axios.post(`/inventories/adjust`, formData);
            } catch (err) {
                console.log(err.response);
                const res = err.response;
                if (!res) {
                    this.error = ['Network error'];
                }
                // 422 → validation / business errors
                else if (res.status === 422 && res.data.errors) {
                    this.error = Object.values(res.data.errors).flat();
                }
                // 500 → server error
                else if (res.status === 500) {
                    this.error = [res.data.errors.message || 'Server error'];
                }
                // fallback
                else {
                    this.error = ['Unexpected error occurred'];
                }
            } finally {
                this.loading = false;
            }
        },
        async deleteStock(id) {
            this.deleteLoading = true;
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