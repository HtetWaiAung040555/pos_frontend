import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "@/utils/config";
import { normalizeApiError } from "@/utils/NormalizeApiError";

const api_url = API_URL;

export const useWalletStore = defineStore('wallet', {
    state: () => ({
        walletList: null,
        loading: false,
        deleteLoading: false,
        data: null,
        error: [],
    }),

    actions: {
        async fetchAllWallet() {
            this.loading = true
            try {
                const response = await axios.get(`/customers_transactions`);
                this.walletList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
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
                this.error = normalizeApiError(err);
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
                this.error = normalizeApiError(err);
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
                this.error = normalizeApiError(err);
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
                this.error = normalizeApiError(err); 
            } finally {
                this.deleteLoading = false;
            }
        }
    }
});