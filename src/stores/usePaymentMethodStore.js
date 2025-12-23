import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "@/utils/config";
import { normalizeApiError } from "@/utils/NormalizeApiError";

const api_url = API_URL;

export const usePaymentMethodStore = defineStore('payment_method', {
    state: () => ({
        paymentMethodList: null,
        loading: false,
        deleteLoading: false,
        data: null,
        error: [],
    }),

    actions: {
        async fetchAllPaymentMethod() {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/payment_methods`);
                this.paymentMethodList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchPaymentMethod(paymentMethodId) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/payment_methods/${paymentMethodId}`);
                this.paymentMethodList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addPaymentMethod(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/payment_methods`, formData);
                this.paymentMethodList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editPaymentMethod(formData, paymentMethodId) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.put(`/payment_methods/${paymentMethodId}`, formData);
                this.paymentMethodList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deletePaymentMethod(paymentMethodId) {
            this.deleteLoading = true;
            this.error = [];
            try {
                const response = await axios.delete(`/payment_methods/${paymentMethodId}`);
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err); 
            } finally {
                this.deleteLoading = false;
            }
        }
    }
});