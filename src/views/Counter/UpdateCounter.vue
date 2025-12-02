<script setup>
    import PageTitle from '@/components/PageTitle.vue';
    import BaseButton from '@/components/BaseButton.vue';
    import { useRoute, useRouter } from 'vue-router';
    import { onMounted, ref } from 'vue';
    import { useCounterStore } from '@/stores/useCounterStore';
    import { useBranchStore } from '@/stores/useBranchStore';
    import BaseCard from '@/components/BaseCard.vue';
    import BaseInput from '@/components/BaseInput.vue';
    import BaseTextarea from '@/components/BaseTextarea.vue';
    import BaseLabel from '@/components/BaseLabel.vue';
    import BaseSwitch from '@/components/BaseSwitch.vue';
    import SubTitle from '@/components/SubTitle.vue';
    import { useToast } from 'primevue';
    import { Select } from 'primevue';

    const router = useRouter();
    const route = useRoute();
    const useCounter = useCounterStore();
    const useBranch = useBranchStore();
    const toast = useToast();

    const formData = ref({});
    const counterStatus = ref(true);
    const userData = ref({});
    const selectedBranch = ref('');

    // Change route function
    function changeRoute(pathname) {
        router.push(pathname);
    }

    onMounted(async () => {
        await useCounter.fetchCounter(route.query.id);
        await useBranch.fetchAllBranch();
        formData.value = useCounter.counterList;
        counterStatus.value = formData.value.status.id === 1 ? true : false;
        userData.value = JSON.parse(localStorage.getItem('user'));
        selectedBranch.value = useBranch.branchList.filter(el => el.id === formData.value.branch.id)[0];
    });

    // Update function
    async function formSubmit() {
        let updatedData = {
            name: formData.value.name,
            desc: formData.value.desc,
            branch_id: selectedBranch.value.id,
            status_id: counterStatus.value? '1' : '2',
            updated_by: userData.value.id
        }
        await useCounter.editCounter(updatedData, route.query.id);
        if(useCounter.error) {
            Object.values(useCounter.error).forEach((err) => {
                err.forEach((msg) => {
                    toast.add({ severity: 'error', summary: 'Error Message', detail: msg, life: 3000 });
                })
            })
            return
        }
        if (useCounter.counterList) {
            toast.add({ severity: 'success', summary: 'Success Message', detail: 'Counter updated successfully.', life: 3000 });
            router.push('/counter');
        }
    }



</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Update Counter">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary" @click="changeRoute('/counter')"  />
                </div>
            </template>
        </PageTitle>
        <!-- Form Section -->
        <BaseCard class="mt-3">
            <template #cardElements>
                <!-- Form section subtitle -->
                <SubTitle label="Basic Info" />
                <div class="flex gap-x-4 mt-6">
                    <!-- Counter Name Input -->
                    <BaseInput
                        size="sm"
                        v-model="formData.name"
                        label="Name"
                        placeholder="Name"
                        width="300px"
                        height="h-[35px]"
                        :isRequire="true"
                    />
                    <!-- Counter Status -->
                    <div class="flex flex-col gap-y-1 w-[200px]">
                        <BaseLabel label="Status" />
                        <BaseSwitch v-model="counterStatus" />
                    </div>
                </div>    
                <div class="flex gap-x-4 mt-4">
                    <!-- Branch Select -->
                    <div class="flex flex-col gap-y-1">
                        <BaseLabel 
                            label="Branch"
                            :isRequire="true"
                        />
                        <Select 
                            v-model="selectedBranch" 
                            :options="useBranch.branchList" 
                            showClear
                            filter
                            optionLabel="name"
                            placeholder="Select a branch"
                            class="w-[300px] h-[35px] items-center" 
                        />
                    </div>
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Description input -->
                    <BaseTextarea
                        v-model="formData.desc"
                        label="Description"
                        placeholder="Description"
                        autoResize
                    />
                </div>
                <div class="flex justify-end mt-4">
                    <!-- Save Button -->
                    <BaseButton 
                        label="Update" 
                        :isLoading="useCounter.loading" 
                        :icon="useCounter.loading? 'fa fa-spinner' : 'fa fa-floppy-disk'" 
                        severity="primary" 
                        @click="formSubmit" 
                        :disabled="useCounter.loading"  
                    />
                </div>
            </template>
        </BaseCard>
    </div>


</template>

<style>


</style>