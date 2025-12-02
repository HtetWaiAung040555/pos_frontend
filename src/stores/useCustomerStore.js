import axios from "axios";
import { defineStore } from "pinia";

export const useCustomerStore = defineStore('customer', {
    state: () => ({
        customerList: [],
        lastId: '',
        loading: false,
        deleteLoading: false,
        error: null,
        data: null

    }),
    actions: {
        async fetchAllCustomer() {
            this.loading = true;
            try {
                const response = await axios.get(`/customers`);
                this.customerList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async fetchCustomer(id) {
            this.loading = true;
            try {
                const response = await axios.get(`/customers/${id}`);
                this.customerList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async fetchLastCustomerId() {
            this.loading = true;
            try {
                const response = await axios.get(`/customers/last-id`);
                this.lastId = response.data.last_id;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async addCustomer(formData) {
            this.loading = true;
            try {
                const response = await axios.post(`/customers`, formData);
                this.customerList = response.data.data;
            } catch(err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
            } finally {
                this.loading = false;
            }
        },
        async editCustomer(id, formData) {
            this.loading = true;
            try {
                const response = await axios.put(`/customers/${id}`, formData)
                this.customerList = response.data.data
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
                
            } finally {
                this.loading = false;
            }
        },
        async deleteCustomer(id) {
            this.deleteLoading = true;
            try {
                const response = await axios.delete(`/customers/${id}`);
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
        async fetchSingleCustomer(id) {
            this.loading = true;
            try {
                const response = await axios.get(`/customers/${id}`);
                this.singleCustomer = response.data.data; 
                return this.singleCustomer;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        }

    }

});