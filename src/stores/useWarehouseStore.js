import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "@/utils/config";

export const useWarehouseStore = defineStore('warehouse', {
    state: () => ({
        warehouseList: [],
        loading: false,
        deleteLoading: false,
        data: null,
        error: null
    }),

    actions: {
        async fetchAllWarehouse() {
            this.loading = true;
            try {
                const response = await axios.get(`/warehouses`);
                this.warehouseList = response.data.data;
                
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },      
        async fetchWarehouse(warehouseId) {
            this.loading = true;
            try {
                const response = await axios.get(`/warehouses/${warehouseId}`);
                this.warehouseList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async addWarehouse(formData) {
            this.loading = true;
            try {
                const response = await axios.post(`/warehouses`, formData);
                this.warehouseList = response.data.data;
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
            } finally {
                this.loading = false;
            }
        },
        async editWarehouse(formData, warehouseId) {
            this.loading = true;
            try {
                const response = await axios.put(`/warehouses/${warehouseId}`, formData);
                this.warehouseList = response.data.data;
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
            } finally {
                this.loading = false;
            }
        },
        async deleteWarehouse(warehouseId) {
            this.deleteLoading = true;
            try {
                const response = await axios.delete(`/warehouses/${warehouseId}`);
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
        }
    }

});