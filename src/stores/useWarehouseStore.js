import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "@/utils/config";
import { normalizeApiError } from "@/utils/NormalizeApiError";

export const useWarehouseStore = defineStore('warehouse', {
    state: () => ({
        warehouseList: [],
        loading: false,
        deleteLoading: false,
        data: null,
        error: []
    }),

    actions: {
        async fetchAllWarehouse() {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/warehouses`);
                this.warehouseList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },      
        async fetchWarehouse(warehouseId) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/warehouses/${warehouseId}`);
                this.warehouseList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addWarehouse(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/warehouses`, formData);
                this.warehouseList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editWarehouse(formData, warehouseId) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.put(`/warehouses/${warehouseId}`, formData);
                this.warehouseList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deleteWarehouse(warehouseId) {
            this.deleteLoading = true;
            this.error = [];
            try {
                const response = await axios.delete(`/warehouses/${warehouseId}`);
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.deleteLoading = false;
            }
        }
    }

});