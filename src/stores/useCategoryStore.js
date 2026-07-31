import { defineStore } from "pinia";
import axios from "axios";
import { normalizeApiError } from "@/utils/NormalizeApiError";
import { normalizeCategory } from "@/utils/categories";

export const useCategoryStore = defineStore('category', {
    state: () => ({
        categoryList: [],
        category: null,
        loading: false,
        deleteLoading: false,
        data: null,
        error: [],
        deleteBlockers: [],
    }),

    actions: {
        async fetchAllCategory() {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/categories`);
                this.categoryList = Array.isArray(response.data.data)
                    ? response.data.data.map(normalizeCategory)
                    : [];
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchCategory(categoryId) {
            this.loading = true;
            this.error = [];
            this.category = null;
            try {
                const response = await axios.get(`/categories/${categoryId}`);
                this.category = normalizeCategory(response.data.data);
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addCategory(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/categories`, formData);
                this.category = normalizeCategory(response.data.data);
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editCategory(formData, categoryId) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.put(`/categories/${categoryId}`, formData);
                this.category = normalizeCategory(response.data.data);
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deleteCategory(categoryId) {
            this.deleteLoading = true;
            this.error = [];
            this.deleteBlockers = [];
            try {
                const response = await axios.delete(`/categories/${categoryId}`);
                this.data = response;
            } catch (err) {
                this.deleteBlockers = Array.isArray(err.response?.data?.blockers)
                    ? err.response.data.blockers
                    : [];
                this.error = normalizeApiError(err);
            } finally {
                this.deleteLoading = false;
            }
        }
    }
});
