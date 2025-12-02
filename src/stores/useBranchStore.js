import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "@/utils/config";

const api_url = API_URL;

export const useBranchStore = defineStore('branch', {
    state: () => ({
        branchList: null,
        loading: false,
        deleteLoading: false,
        data: null,
        error: null,
    }),

    actions: {
        async fetchAllBranch() {
            this.loading = true
            try {
                const response = await axios.get(`/branches`);
                this.branchList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async fetchBranch(branchId) {
            this.loading = true;
            try {
                const response = await axios.get(`/branches/${branchId}`);
                this.branchList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async addBranch(formData) {
            this.loading = true;
            try {
                const response = await axios.post(`/branches`, formData);
                this.branchList = response.data.data;
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
            } finally {
                this.loading = false;
            }
        },
        async editBranch(formData, branchId) {
            this.loading = true;
            try {
                const response = await axios.put(`/branches/${branchId}`, formData);
                this.branchList = response.data.data;
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
            } finally {
                this.loading = false;
            }
        },
        async deleteBranch(branchId) {
            this.deleteLoading = true;
            try {
                const response = await axios.delete(`/branches/${branchId}`);
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