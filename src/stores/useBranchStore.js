import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "@/utils/config";
import { normalizeApiError } from "@/utils/NormalizeApiError";

const api_url = API_URL;

export const useBranchStore = defineStore('branch', {
    state: () => ({
        branchList: null,
        loading: false,
        deleteLoading: false,
        data: null,
        error: [],
    }),

    actions: {
        async fetchAllBranch() {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/branches`);
                this.branchList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchBranch(branchId) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/branches/${branchId}`);
                this.branchList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addBranch(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/branches`, formData);
                this.branchList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editBranch(formData, branchId) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.put(`/branches/${branchId}`, formData);
                this.branchList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deleteBranch(branchId) {
            this.deleteLoading = true;
            this.error = [];
            try {
                const response = await axios.delete(`/branches/${branchId}`);
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.deleteLoading = false;
            }
        }
    }
});