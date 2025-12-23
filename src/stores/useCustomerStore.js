import { normalizeApiError } from "@/utils/NormalizeApiError";
import axios from "axios";
import { defineStore } from "pinia";

export const useCustomerStore = defineStore('customer', {
    state: () => ({
        customerList: [],
        lastId: '',
        loading: false,
        deleteLoading: false,
        error: [],
        data: null

    }),
    actions: {
        async fetchAllCustomer() {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/customers`);
                this.customerList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchCustomer(id) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/customers/${id}`);
                this.customerList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchLastCustomerId() {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/customers/last-id`);
                this.lastId = response.data.last_id;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addCustomer(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/customers`, formData);
                this.customerList = response.data.data;
            } catch(err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editCustomer(id, formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.put(`/customers/${id}`, formData)
                this.customerList = response.data.data
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deleteCustomer(id) {
            this.deleteLoading = true;
            this.error = [];
            try {
                const response = await axios.delete(`/customers/${id}`);
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.deleteLoading = false;
            }
        },
        async fetchSingleCustomer(id) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/customers/${id}`);
                this.singleCustomer = response.data.data; 
                return this.singleCustomer;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        }

    }

});