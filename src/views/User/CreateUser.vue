<script setup>

    import PageTitle from '@/components/PageTitle.vue';
    import BaseButton from '@/components/BaseButton.vue';
    import BaseCard from '@/components/BaseCard.vue';
    import SubTitle from '@/components/SubTitle.vue';
    import { useRouter } from 'vue-router';
    import BaseInput from '@/components/BaseInput.vue';
    import { onMounted, ref, watch } from 'vue';
    import { useToast } from 'primevue/usetoast';
    import BaseSwitch from '@/components/BaseSwitch.vue';
    import BaseLabel from '@/components/BaseLabel.vue';
    import { useUserStore } from '@/stores/useUserStore';
    import { useBranchStore } from '@/stores/useBranchStore';
    import { Select } from 'primevue';
    import { useUserRoleStore } from '@/stores/useUserRoleStore';
    import { useCounterStore } from '@/stores/useCounterStore';
    import BaseErrorLabel from '@/components/BaseErrorLabel.vue';
    import { errMsgList } from '@/utils/const';
    
    const router = useRouter();
    const toast = useToast();
    const useUser = useUserStore();
    const useBranch = useBranchStore();
    const useRole = useUserRoleStore();
    const useCounter = useCounterStore();

    const formData = ref(
      {
        name: "",
        email: "",
        password: "",
        branch_id: "",
        counter_id: "",
        status_id: "1",
        role_id: "",
        created_by: "",
      }
    )
    const status = ref(true);
    const userData = ref({});
    const selectedBranch = ref('');
    const selectedRole = ref('');
    const selectedCounter = ref('');
    const filteredCounters = ref([]);
    const errorMsg = ref({
        name: "",
        email: "",
        password: "",
        role: ""
    });

    // Change route function
    function changeRoute(pathname) {
        router.push(pathname);
    }

    onMounted(async() => {
        userData.value = JSON.parse(localStorage.getItem('user'));
        await useBranch.fetchAllBranch();
        await useRole.fetchAllRole();
        await useCounter.fetchAllCounter();
    });

    watch(selectedBranch, (newBranch) => {
        if (newBranch) {
            // filter counters by branch_id
            filteredCounters.value = useCounter.counterList.filter(
                (c) => c.branch.id === newBranch.id
            );
            // reset counter if it doesn't belong
            if (!filteredCounters.value.some(c => c.id === selectedCounter.value?.id)) {
            selectedCounter.value = null;
            }
        } else {
            filteredCounters.value = [];
            selectedCounter.value = null;
        }
    });

    watch(selectedCounter, (newCounter) => {
        if (newCounter) {
            const branch = useBranch.branchList.find(
            (b) => b.id === newCounter.branch.id
            );
            selectedBranch.value = branch || null;
        }
    });


    // Create branch function
    async function formSubmit() {
        if (formData.value.name === "") {
            errorMsg.value = {
                name: errMsgList.name,
                role: "",
                email: "",
                password: ""
            };
            return
        } else if (!selectedRole.value) {
            errorMsg.value = {
                name: "",
                role: errMsgList.role,
                email: "",
                password: ""
            };
            return
        } else if (formData.value.email === "") {
            errorMsg.value = {
                name: "",
                role: "",
                email: errMsgList.email,
                password: ""
            };
            return
        } else if (formData.value.password === "") {
            errorMsg.value = {
                name: "",
                role: "",
                email: "",
                password: errMsgList.password
            };
            return
        } else if (formData.value.password.length < 8) {
            errorMsg.value = {
                name: "",
                role: "",
                email: "",
                password: "Password must have 8 characters."
            };
            return
        }
        formData.value = {
            ...formData.value,
            role_id: selectedRole.value.id,
            branch_id: selectedBranch.value.id,
            counter_id: selectedCounter.value.id,
            created_by: userData.value.id,
            status_id: status.value? '1' : '2'
        };
        console.log(formData);
        await useUser.addUser(formData.value);
        if(useUser.error) {
            Object.values(useUser.error).forEach((err) => {
                err.forEach((msg) => {
                    toast.add({ severity: 'error', summary: 'Error Message', detail: msg, life: 3000 });
                })
            })
            return
        }
        if (useUser.users) {
            toast.add({ severity: 'success', summary: 'Success Message', detail: 'User created successfully.', life: 3000 });
            router.push('/user');
        }
    }

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Create User">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary" @click="changeRoute('/user')"  />
                </div>
            </template>
        </PageTitle>
        <!-- Form Section -->
        <BaseCard class="mt-3">
            <template #cardElements>
                <!-- Form section subtitle -->
                <SubTitle label="Basic Info" />
                <div class="flex gap-x-4 mt-6">
                    <!-- User Name Input -->
                    <BaseInput
                        size="sm"
                        v-model="formData.name"
                        label="Name"
                        placeholder="Name"
                        width="300px"
                        height="h-[35px]"
                        :isRequire="true"
                        :error="errorMsg.name"
                    />
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Role Select -->
                    <div class="flex flex-col gap-y-1">
                        <BaseLabel 
                            label="Role"
                            :isRequire="true"
                        />
                        <Select 
                            v-model="selectedRole" 
                            :options="useRole.roleList" 
                            showClear
                            filter
                            optionLabel="name"
                            placeholder="Select a branch"
                            class="w-[300px] h-[35px] items-center" 
                        />
                        <BaseErrorLabel v-if="errorMsg.role" :label="errorMsg.role" />
                    </div>
                    <!-- Branch Status -->
                    <div class="flex flex-col gap-y-1 w-[200px]">
                        <BaseLabel label="Status" />
                        <BaseSwitch v-model="status" />
                    </div>
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Email input -->
                    <BaseInput
                        size="sm"
                        v-model="formData.email"
                        label="Email"
                        placeholder="Email"
                        width="300px"
                        height="h-[35px]"
                        type="email"
                        :isRequire="true"
                        :error="errorMsg.email"
                    />
                    <!-- Password -->
                    <BaseInput
                        size="sm"
                        v-model="formData.password"
                        label="Password"
                        width="300px"
                        height="h-[35px]"
                        type="password"
                        passwordToggle
                        :isRequire="true"
                        :error="errorMsg.password"
                    />
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Branch Select -->
                    <div class="flex flex-col gap-y-1">
                        <BaseLabel 
                            label="Branch"
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
                    <!-- Counter Select -->
                    <div class="flex flex-col gap-y-1">
                        <BaseLabel 
                            label="Counter"
                        />
                        <Select 
                            v-model="selectedCounter" 
                            :options="filteredCounters.length > 1? filteredCounters : useCounter.counterList" 
                            filter
                            showClear
                            optionLabel="name"
                            placeholder="Select a counter"
                            class="w-[300px] h-[35px] items-center" 
                        />
                    </div>
                </div>
                <div class="flex justify-end mt-4">
                    <!-- Save Button -->
                    <BaseButton 
                        label="Save" 
                        :isLoading="useUser.loading" :icon="useUser.loading? 'fa fa-spinner' : 'fa fa-floppy-disk'" 
                        severity="primary" 
                        @click="formSubmit" 
                        :disabled="useUser.loading"  
                    />
                </div>
            </template>
        </BaseCard>
    </div>
</template>
