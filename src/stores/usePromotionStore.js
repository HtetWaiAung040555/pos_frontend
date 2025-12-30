import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "@/utils/config";
import { normalizeApiError } from "@/utils/NormalizeApiError";

const api_url = API_URL;

export const usePromotionStore = defineStore('wallet', {
    state: () => ({
        promoList: null,
        loading: false,
        deleteLoading: false,
        data: null,
        error: [],
    }),

    actions: {
        async fetchAllPromo() {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/promotions`);
                this.promoList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchPromo(id) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/promotions/${id}`);
                this.promoList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addPromo(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/promotions`, formData);
                this.promoList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editPromo(formData, id) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.put(`/promotions/${id}`, formData);
                this.promoList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deletePromo(data, id) {
            this.deleteLoading = true;
            this.error = [];
            try {
                const response = await axios.delete(`/promotions/${id}`, {data: data});
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.deleteLoading = false;
            }
        }
    }
});