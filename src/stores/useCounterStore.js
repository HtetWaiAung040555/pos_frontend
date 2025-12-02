import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "@/utils/config";

const api_url = API_URL;

export const useCounterStore = defineStore('counter', {
    state: () => ({
        counterList: null,
        loading: false,
        deleteLoading: false,
        data: null,
        error: null,
    }),

    actions: {
        async fetchAllCounter() {
            this.loading = true
            this.error = null
            try {
                const response = await axios.get(`/counters`);
                this.counterList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async fetchCounter(counterId) {
            this.loading = true;
            this.error = null;
            try {
                const response = await axios.get(`/counters/${counterId}`);
                this.counterList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async addCounter(formData) {
            this.loading = true;
            this.error = null;
            try {
                const response = await axios.post(`/counters`, formData);
                this.counterList = response.data.data;
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
            } finally {
                this.loading = false;
            }
        },
        async editCounter(formData, counterId) {
            this.loading = true,
            this.error = null
            try {
                const response = await axios.put(`/counters/${counterId}`, formData)
                this.counterList = response.data.data
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
                
            } finally {
                this.loading = false;
            }
        },
        async deleteCounter(counterId) {
            this.deleteLoading = true,
            this.error = null
            try {
                const response = await axios.delete(`/counters/${counterId}`);
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