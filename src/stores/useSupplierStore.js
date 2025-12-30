import { normalizeApiError } from "@/utils/NormalizeApiError";
import axios from "axios";
import { defineStore } from "pinia";

export const useSupplierStore = defineStore('supplier', {
    state: () => ({
        supplierList: [],
        lastId: '',
        loading: false,
        deleteLoading: false,
        error: [],
        data: null

    }),
    actions: {
        async fetchAllSupplier() {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/suppliers`);
                this.supplierList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchSupplier(id) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/suppliers/${id}`);
                this.supplierList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchLastSupplierId() {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/suppliers/last-id`);
                this.lastId = response.data.last_id;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addSupplier(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/suppliers`, formData);
                this.supplierList = response.data.data;
            } catch(err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editSupplier(id, formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.put(`/suppliers/${id}`, formData)
                this.supplierList = response.data.data
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deleteSupplier(id) {
            this.deleteLoading = true;
            this.error = [];
            try {
                const response = await axios.delete(`/suppliers/${id}`);
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.deleteLoading = false;
            }
        },
        async fetchSingleSupplier(id) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/suppliers/${id}`);
                this.singleSupplier = response.data.data; 
                return this.singleSupplier;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        }

    }

});