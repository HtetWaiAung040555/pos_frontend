import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "@/utils/config";

const api_url = API_URL;

export const usePromotionStore = defineStore('wallet', {
    state: () => ({
        promoList: null,
        loading: false,
        deleteLoading: false,
        data: null,
        error: null,
    }),

    actions: {
        async fetchAllPromo() {
            this.loading = true
            try {
                const response = await axios.get(`/promotions`);
                this.promoList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async fetchPromo(id) {
            this.loading = true;
            try {
                const response = await axios.get(`/promotions/${id}`);
                this.promoList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async addPromo(formData) {
            this.loading = true;
            try {
                const response = await axios.post(`/promotions`, formData);
                this.promoList = response.data.data;
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
            } finally {
                this.loading = false;
            }
        },
        async editPromo(formData, id) {
            this.loading = true;
            try {
                const response = await axios.put(`/promotions/${id}`, formData);
                this.promoList = response.data.data;
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
            } finally {
                this.loading = false;
            }
        },
        async deletePromo(data, id) {
            this.deleteLoading = true;
            try {
                console.log(data);
                const response = await axios.delete(`/promotions/${id}`, {data: data});
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