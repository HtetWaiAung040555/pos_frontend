import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "@/utils/config";

const api_url = API_URL;

export const useWalletStore = defineStore('wallet', {
    state: () => ({
        walletList: null,
        loading: false,
        deleteLoading: false,
        data: null,
        error: null,
    }),

    actions: {
        async fetchAllWallet() {
            this.loading = true
            try {
                const response = await axios.get(`/customers_transactions`);
                this.walletList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async fetchWallet(walletId) {
            this.loading = true;
            try {
                const response = await axios.get(`/customers_transactions/${walletId}`);
                this.walletList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async addWallet(formData) {
            this.loading = true;
            try {
                const response = await axios.post(`/customers_transactions`, formData);
                this.walletList = response.data.data;
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
            } finally {
                this.loading = false;
            }
        },
        async editWallet(formData, walletId) {
            this.loading = true;
            try {
                const response = await axios.put(`/customers_transactions/${walletId}`, formData);
                this.walletList = response.data.data;
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
            } finally {
                this.loading = false;
            }
        },
        async deleteWallet(walletId) {
            this.deleteLoading = true;
            try {
                const response = await axios.delete(`/customers_transactions/${walletId}`);
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