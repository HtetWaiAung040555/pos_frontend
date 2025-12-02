import { defineStore } from "pinia";

export const useCollapseSidebar = defineStore('Collapse', {
    state: () => ({
        isSidebarCollapsed: true,
    }),
    actions: {
        toggleSidebar() {
            this.isSidebarCollapsed = !this.isSidebarCollapsed;
        },
    }
});