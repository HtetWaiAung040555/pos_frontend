import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "@/utils/config";

const api_url = API_URL;

export const usePaymentMethodStore = defineStore('payment_method', {
    state: () => ({
        paymentMethodList: null,
        loading: false,
        deleteLoading: false,
        data: null,
        error: null,
    }),

    actions: {
        async fetchAllPaymentMethod() {
            this.loading = true
            try {
                const response = await axios.get(`/payment_methods`);
                this.paymentMethodList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async fetchPaymentMethod(paymentMethodId) {
            this.loading = true;
            try {
                const response = await axios.get(`/payment_methods/${paymentMethodId}`);
                this.paymentMethodList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async addPaymentMethod(formData) {
            this.loading = true;
            try {
                const response = await axios.post(`/payment_methods`, formData);
                this.paymentMethodList = response.data.data;
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
            } finally {
                this.loading = false;
            }
        },
        async editPaymentMethod(formData, paymentMethodId) {
            this.loading = true;
            try {
                const response = await axios.put(`/payment_methods/${paymentMethodId}`, formData);
                this.paymentMethodList = response.data.data;
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
            } finally {
                this.loading = false;
            }
        },
        async deletePaymentMethod(paymentMethodId) {
            this.deleteLoading = true;
            try {
                const response = await axios.delete(`/payment_methods/${paymentMethodId}`);
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