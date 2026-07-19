"use client";

import { useEffect, useState } from "react";
import { userService } from "@/services/userService";
import { AppUser } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { subscribeToActiveRiceTypes, deactivateRiceType, seedRiceTypes } from "@/services/riceTypeService";
import { RiceType } from "@/types/riceTypes";
import { useAuthStore } from "@/stores/authStore";
import { AddRiceTypeDialog } from "./AddRiceTypeDialog";
import toast from "react-hot-toast";
import { useUiStore } from "@/stores/uiStore";

export default function UserManagementPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [riceTypes, setRiceTypes] = useState<RiceType[]>([]);
  const [seeding, setSeeding] = useState(false);
  const { user } = useAuthStore();

  const fetchUsers = async () => {
    try {
      const data = await userService.getAllUsers();
      setUsers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    const unsub = subscribeToActiveRiceTypes(setRiceTypes);
    return unsub;
  }, []);

  const handleStatusChange = async (uid: string, currentStatus: string) => {
    try {
      if (currentStatus === "active") {
        const confirm = await useUiStore.getState().requestConfirm("Suspend User", "Are you sure you want to suspend this user?");
        if (confirm) {
          await userService.removeUser(uid);
        }
      } else {
        await userService.approveUser(uid);
      }
      fetchUsers();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleRoleChange = async (uid: string, newRole: "admin" | "superadmin") => {
    const confirm = await useUiStore.getState().requestConfirm("Change Role", `Change role to ${newRole}?`);
    if (confirm) {
      try {
        await userService.updateUserRole(uid, newRole);
        fetchUsers();
      } catch (error) {
        toast.error("Failed to update role");
      }
    }
  };

  const handleDeactivateRiceType = async (riceTypeId: string) => {
    const confirm = await useUiStore.getState().requestConfirm("Deactivate Rice Type", "Deactivate this rice type? It will no longer appear in dropdowns.");
    if (confirm) {
      await deactivateRiceType(riceTypeId);
    }
  };

  const handleSeed = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedRiceTypes(user.uid);
      toast.success("Seeded defaults!");
    } catch (e: any) {
      toast.error("Error seeding: " + e.message);
    }
    setSeeding(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
      </div>

      <Tabs defaultValue="users" className="flex-1 flex flex-col">
        <TabsList className="w-fit mb-4">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="ricetypes">Rice Types</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users">
          <Card className="shadow-sm">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle>All Registered Users</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white text-gray-500 border-b">
                    <tr>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading users...</td></tr>
                    ) : users.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No users found.</td></tr>
                    ) : (
                      users.map(u => (
                        <tr key={u.uid} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 font-medium">{u.displayName || "N/A"}</td>
                          <td className="px-6 py-4 text-gray-600">{u.email}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              u.status === 'active' ? 'bg-green-100 text-green-800' : 
                              u.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {u.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <select 
                              className="text-xs border rounded p-1"
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.uid, e.target.value as any)}
                            >
                              <option value="admin">Admin</option>
                              <option value="superadmin">SuperAdmin</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {u.status === "active" ? (
                              <button onClick={() => handleStatusChange(u.uid, u.status)} className="text-red-600 hover:text-red-800 font-medium text-xs">
                                Suspend
                              </button>
                            ) : (
                              <button onClick={() => handleStatusChange(u.uid, u.status)} className="text-green-600 hover:text-green-800 font-medium text-xs">
                                Approve
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ricetypes">
          <Card className="shadow-sm">
            <CardHeader className="bg-gray-50 border-b flex flex-row items-center justify-between">
              <CardTitle>Rice Types</CardTitle>
              <div className="flex gap-2">
                <button 
                  onClick={handleSeed}
                  disabled={seeding || riceTypes.length > 0}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 bg-white rounded-md text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  {riceTypes.length > 0 ? "Already seeded" : seeding ? "Seeding..." : "Seed defaults"}
                </button>
                <AddRiceTypeDialog />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white text-gray-500 border-b">
                    <tr>
                      <th className="px-6 py-4">Code</th>
                      <th className="px-6 py-4">Display Name</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {riceTypes.length === 0 ? (
                      <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No active rice types found.</td></tr>
                    ) : (
                      riceTypes.map(rt => (
                        <tr key={rt.riceTypeId} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-700">{rt.code}</td>
                          <td className="px-6 py-4 text-slate-900">{rt.displayName}</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleDeactivateRiceType(rt.riceTypeId)} className="text-red-500 hover:text-red-700 font-semibold text-xs border border-red-200 bg-red-50 px-2 py-1 rounded">
                              Deactivate
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
