<script setup>
import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useRouter } from 'vue-router';
import BaseInput from '@/components/BaseInput.vue';
import BaseTextarea from '@/components/BaseTextarea.vue';
import { onMounted, ref } from 'vue';
import { useCounterStore } from '@/stores/useCounterStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { useToast } from 'primevue/usetoast';
import BaseSwitch from '@/components/BaseSwitch.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import { Select } from 'primevue';
import { errMsgList } from '@/utils/const';
import BaseErrorLabel from '@/components/BaseErrorLabel.vue';

const router = useRouter();
const toast = useToast();
const useCounter = useCounterStore();
const useBranch = useBranchStore();

const formData = ref(
    {
        name: "",
        desc: "",
        branch_id: "",
        status_id: "1",
        created_by: "",
        updated_by: ""
    }
)
const counterStatus = ref(true);
const userData = ref({});
const selectedBranch = ref();
const errorMsg = ref({
    name: "",
    branch: "",
});


// Change route function
function changeRoute(pathname) {
    router.push(pathname);
}

onMounted(async () => {
    userData.value = JSON.parse(localStorage.getItem('user'));
    await useBranch.fetchAllBranch();
});



// Create counter function
async function formSubmit() {
    if (formData.value.name === "") {
        errorMsg.value = {
            name: errMsgList.name,
            branch: ""
        };
        return
    } else if (!selectedBranch.value) {
        errorMsg.value = {
            name: "",
            branch: errMsgList.branch
        };
        return
    }
    errorMsg.value = {
        name: "",
        branch: ""
    };
    formData.value = {
        ...formData.value,
        branch_id: selectedBranch.value.id,
        created_by: userData.value.id,
        status_id: counterStatus.value ? '1' : '2'
    };
    await useCounter.addCounter(formData.value);
    if (useCounter.error.length) {
        useCounter.error.forEach((msg) => {
            toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
            });
        });
        return
    }
    if (useCounter.counterList) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Counter created successfully.', life: 3000 });
        router.push('/counter');
    }
}



</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Create Counter">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary"
                        @click="changeRoute('/counter')" />
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
                    <BaseInput size="sm" v-model="formData.name" label="Name" placeholder="Name" width="300px"
                        height="h-[35px]" :isRequire="true" :error="errorMsg.name" />
                    <!-- Counter Status -->
                    <div class="flex flex-col gap-y-1 w-[200px]">
                        <BaseLabel label="Status" />
                        <BaseSwitch v-model="counterStatus" />
                    </div>
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Branch Select -->
                    <div class="flex flex-col gap-y-1">
                        <BaseLabel label="Branch" :isRequire="true" />
                        <Select v-model="selectedBranch" :options="useBranch.branchList" showClear filter
                            optionLabel="name" placeholder="Select a branch" class="w-[300px] h-[35px] items-center" />
                        <BaseErrorLabel v-if="errorMsg.branch" :label="errorMsg.branch" />
                    </div>
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Description input -->
                    <BaseTextarea v-model="formData.desc" label="Description" placeholder="Description" autoResize />
                </div>
                <div class="flex justify-end mt-4">
                    <!-- Save Button -->
                    <BaseButton label="Save" :isLoading="useCounter.loading"
                        :icon="useCounter.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" severity="primary"
                        @click="formSubmit" :disabled="useCounter.loading" />
                </div>
            </template>
        </BaseCard>
    </div>
</template>

<style></style>