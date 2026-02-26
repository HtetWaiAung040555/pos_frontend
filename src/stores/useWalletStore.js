import { defineStore } from "pinia";
import axios from "axios";
import { normalizeApiError } from "@/utils/NormalizeApiError";

export const useWalletStore = defineStore('wallet', {
    state: () => ({
        walletList: [],
        loading: false,
        deleteLoading: false,
        data: null,
        error: [],
    }),

    actions: {
        async fetchAllWallet(filteredData) {
            this.loading = true;
            this.error = [];
            try {
                let response;
                if (filteredData) {
                    response = await axios.get(`/wallets?start_date=${filteredData.start_date}&end_date=${filteredData.end_date}&customer_id=${filteredData.customer_id}&status_id=${filteredData.status_id}`);
                    this.walletList = response.data.data;
                } else {
                    response = await axios.get(`/wallets`);
                    this.walletList = response.data.data;
                }
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchWallet(walletId) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/wallets/${walletId}`);
                this.walletList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addWallet(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/wallets`, formData);
                this.walletList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editWallet(formData, walletId) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.put(`/wallets/${walletId}`, formData);
                this.walletList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deleteWallet(walletId) {
            this.deleteLoading = true;
            this.error = [];
            try {
                const response = await axios.delete(`/wallets/${walletId}`);
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err); 
            } finally {
                this.deleteLoading = false;
            }
        },
        async syncToCloud(data) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post('/wallets/sync_to_cloud', data)
                this.data = response.data
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        }
    }
});