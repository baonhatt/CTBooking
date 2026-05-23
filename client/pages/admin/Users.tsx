import AdminLayout from '@/admin/layouts/AdminLayout';
import UsersContent from '@/components/admin/content/UsersContent';
import AdminEditModal from '@/components/admin/AdminEditModal';
import React, { useMemo, useState, useEffect } from 'react';
import { getUsers } from '@/lib/api';
import { createAdminUser, updateAdminUser, getUserById } from '@/lib/api/users';
import { getAdminPermissions } from '@/lib/api/admin';
import { Modal, Form, Input, Select, Button, Checkbox, Space, Typography, Divider, Row, Col } from 'antd';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button as UIButton } from '@/components/ui/button';
import { Input as UIInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { SecurityScanOutlined, CheckOutlined, LoadingOutlined } from '@ant-design/icons';
import X from 'lucide-react/dist/esm/icons/x';
import Shield from 'lucide-react/dist/esm/icons/shield';
import Check from 'lucide-react/dist/esm/icons/check';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
const { Title, Text } = Typography;

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [userQuery, setUserQuery] = useState('');
  const pageSize = 10;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [moviesLocal, setMoviesLocal] = useState<any[]>([]);
  const [movieStatus, setMovieStatus] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'viewer' | 'user'
  });
  const [permGroups, setPermGroups] = useState<Record<string, Array<{ key: string; name: string }>> | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editUserForm, setEditUserForm] = useState({ name: '', email: '', role: 'user' as 'admin' | 'viewer' | 'user' });
  const [selectedEditPerms, setSelectedEditPerms] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState(false);
  const [editUserId, setEditUserId] = useState<string | number | null>(null);

  function toLocalDateTimeString(date: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const { data, total } = await getUsers({
          page: usersPage,
          pageSize,
          q: userQuery
        });
        setUsers(
          data.map((u: any) => ({
            id: String(u.id),
            fullname: u.name,
            email: u.email,
            is_active: u.is_active,
            role: u.role,
            permissions_count: u.permissions_count,
            created_at: new Date(u.created_at)
          }))
        );
        setTotalUsers(total);
      } catch (err) {
        console.error('Lỗi load users:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [usersPage, userQuery, pageSize]);

  useEffect(() => {
    if (!isCreateOpen && !isEditUserOpen) return;
    if (permGroups) return;
    (async () => {
      try {
        const g = await getAdminPermissions();
        setPermGroups(g);
      } catch (err) {
        console.error('Lỗi load permissions:', err);
        setPermGroups({});
      }
    })();
  }, [isCreateOpen, isEditUserOpen, permGroups]);

  const usersTotalPages = useMemo(() => Math.max(1, Math.ceil(totalUsers / pageSize)), [totalUsers]);

  const handleOpenEdit = async (_type: 'user', data: any) => {
    const id = data.id;
    setEditUserId(id);
    setEditUserForm({
      name: data.fullname || data.name || '',
      email: data.email || '',
      role: data.role || 'user'
    });
    setSelectedEditPerms(new Set());
    editForm.resetFields();
    editForm.setFieldsValue({
      name: data.fullname || data.name || '',
      email: data.email || '',
      role: data.role || 'user'
    });
    setIsEditUserOpen(true);

    // load current permissions for this user
    try {
      const full = await getUserById(id);
      if (full && Array.isArray(full.permissions)) {
        setSelectedEditPerms(new Set(full.permissions));
      }
    } catch (err) {
      console.error('Lỗi load permissions hiện tại của user:', err);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    const { data, total } = await getUsers({
      page: usersPage,
      pageSize,
      q: userQuery
    });
    setUsers(
      data.map((u: any) => ({
        id: String(u.id),
        fullname: u.fullname || u.name,
        email: u.email,
        is_active: u.is_active,
        role: u.role,
        permissions_count: u.permissions_count || 0,
        created_at: u.created_at ? new Date(u.created_at) : null
      }))
    );
    setTotalUsers(total);
    setIsLoading(false);
  };

  const handleOpenCreate = () => {
    setCreateForm({ name: '', email: '', password: '', role: 'user' });
    setSelectedPerms(new Set());
    form.resetFields();
    setIsCreateOpen(true);
  };

  return (
    <AdminLayout
      active={'users' as any}
      setActive={(() => {}) as any}
      adminEmailState={localStorage.getItem('adminEmail') || 'admin@email.com'}
      handleLogout={() => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminEmail');
        window.dispatchEvent(new Event('admin-auth-changed'));
        window.location.href = '/';
      }}
    >
      <UsersContent
        data={users}
        totalPages={usersTotalPages}
        currentPage={usersPage}
        setPage={setUsersPage}
        pageSize={pageSize}
        userQuery={userQuery}
        setUserQuery={setUserQuery}
        onEdit={handleOpenEdit}
        onCreate={handleOpenCreate}
        usersLength={totalUsers}
        onRefresh={handleRefresh}
        isLoading={isLoading}
      />

      <Modal
        title={<Title level={4}>Tạo người dùng</Title>}
        open={isCreateOpen}
        onCancel={() => setIsCreateOpen(false)}
        footer={null}
        width={800}
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={createForm}
          onValuesChange={(_, allValues) => setCreateForm(allValues)}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Họ tên" name="name" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
                <Input placeholder="Nhập họ tên đầy đủ" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Role" name="role" rules={[{ required: true, message: 'Vui lòng chọn role' }]}>
                <Select>
                  <Select.Option value="user">user</Select.Option>
                  <Select.Option value="admin">admin</Select.Option>
                  <Select.Option value="viewer">viewer</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Email"
                name="email"
                rules={[
                  { required: true, message: 'Vui lòng nhập email' },
                  { type: 'email', message: 'Email không hợp lệ' }
                ]}
              >
                <Input placeholder="user@example.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Mật khẩu"
                name="password"
                rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
              >
                <Input.Password placeholder="Nhập mật khẩu" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Phân quyền</Divider>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong>Phân quyền</Text>
              <Space>
                <Button size="small" onClick={() => setSelectedPerms(new Set())}>
                  Bỏ chọn
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    const allKeys = Object.values(permGroups || {}).flatMap((p) => p.map((x) => x.key));
                    setSelectedPerms(new Set(allKeys));
                  }}
                >
                  Chọn tất cả
                </Button>
              </Space>
            </div>
            <div
              style={{
                maxHeight: 320,
                overflowY: 'auto',
                border: '1px solid #d9d9d9',
                borderRadius: 8,
                padding: 16,
                backgroundColor: '#fafafa'
              }}
            >
              {permGroups && Object.keys(permGroups).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#8c8c8c' }}>
                  <Text>Không có quyền nào</Text>
                </div>
              ) : (
                Object.entries(permGroups || {}).map(([group, perms]) => (
                  <div key={group} style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 12
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', color: '#8c8c8c' }}>
                        <SecurityScanOutlined style={{ marginRight: 8 }} />
                        {group}
                      </Text>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          const next = new Set(selectedPerms);
                          const keys = perms.map((p) => p.key);
                          const allSelected = keys.every((k) => next.has(k));
                          if (allSelected) {
                            keys.forEach((k) => next.delete(k));
                          } else {
                            keys.forEach((k) => next.add(k));
                          }
                          setSelectedPerms(next);
                        }}
                      >
                        {perms.every((p) => selectedPerms.has(p.key)) ? 'Bỏ hết' : 'Chọn hết'}
                      </Button>
                    </div>
                    <Row gutter={[8, 8]}>
                      {perms.map((p) => (
                        <Col span={12} key={p.key}>
                          <div
                            style={{
                              padding: '12px 16px',
                              border: '1px solid #d9d9d9',
                              borderRadius: 6,
                              backgroundColor: '#fff',
                              cursor: 'pointer',
                              transition: 'all 0.3s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8
                            }}
                            onClick={() => {
                              const next = new Set(selectedPerms);
                              if (next.has(p.key)) next.delete(p.key);
                              else next.add(p.key);
                              setSelectedPerms(next);
                            }}
                          >
                            <Checkbox
                              checked={selectedPerms.has(p.key)}
                              onChange={(e) => {
                                const next = new Set(selectedPerms);
                                if (e.target.checked) next.add(p.key);
                                else next.delete(p.key);
                                setSelectedPerms(next);
                              }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500, color: '#262626' }}>{p.name}</div>
                              <div style={{ fontSize: 10, color: '#bfbfbf', fontFamily: 'monospace', marginTop: 2 }}>
                                {p.key}
                              </div>
                            </div>
                            {selectedPerms.has(p.key) && <CheckOutlined style={{ color: '#1890ff' }} />}
                          </div>
                        </Col>
                      ))}
                    </Row>
                  </div>
                ))
              )}
            </div>
          </Space>
        </Form>
        <div
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8
          }}
        >
          <Button onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
            Hủy
          </Button>
          <Button
            type="primary"
            loading={isCreating}
            onClick={async () => {
              try {
                const values = await form.validateFields();
                const name = values.name.trim();
                const email = values.email.trim().toLowerCase();
                const password = values.password;

                setIsCreating(true);
                await createAdminUser({
                  name,
                  email,
                  password,
                  role: values.role,
                  permissions: Array.from(selectedPerms)
                });
                toast.success('Thành công', {
                  description: 'Đã tạo người dùng'
                });
                setIsCreateOpen(false);
                await handleRefresh();
              } catch (err: any) {
                if (err.errorFields) {
                  return; // Form validation error
                }
                toast.error('Lỗi', {
                  description: err?.message || 'Không thể tạo người dùng'
                });
              } finally {
                setIsCreating(false);
              }
            }}
          >
            Tạo người dùng
          </Button>
        </div>
      </Modal>

      {/* Edit User Modal (identical permission UI as Create) */}
      <Modal
        title={<Title level={4}>Chỉnh sửa người dùng</Title>}
        open={isEditUserOpen}
        onCancel={() => setIsEditUserOpen(false)}
        footer={null}
        width={800}
        style={{ top: 100 }}
      >
        <Form
          form={editForm}
          layout="vertical"
          initialValues={editUserForm}
          onValuesChange={(_, allValues) => setEditUserForm(allValues)}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Họ tên" name="name" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
                <Input placeholder="Nhập họ tên đầy đủ" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Role" name="role" rules={[{ required: true, message: 'Vui lòng chọn role' }]}>
                <Select>
                  <Select.Option value="user">user</Select.Option>
                  <Select.Option value="admin">admin</Select.Option>
                  <Select.Option value="viewer">viewer</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Email"
                name="email"
                rules={[
                  { required: true, message: 'Vui lòng nhập email' },
                  { type: 'email', message: 'Email không hợp lệ' }
                ]}
              >
                <Input placeholder="user@example.com" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Phân quyền</Divider>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong>Phân quyền</Text>
              <Space>
                <Button size="small" onClick={() => setSelectedEditPerms(new Set())}>
                  Bỏ chọn
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    const allKeys = Object.values(permGroups || {}).flatMap((p) => p.map((x) => x.key));
                    setSelectedEditPerms(new Set(allKeys));
                  }}
                >
                  Chọn tất cả
                </Button>
              </Space>
            </div>
            <div
              style={{
                maxHeight: 320,
                overflowY: 'auto',
                border: '1px solid #d9d9d9',
                borderRadius: 8,
                padding: 16,
                backgroundColor: '#fafafa'
              }}
            >
              {permGroups && Object.keys(permGroups).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#8c8c8c' }}>
                  <Text>Không có quyền nào</Text>
                </div>
              ) : (
                Object.entries(permGroups || {}).map(([group, perms]) => (
                  <div key={group} style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 12
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', color: '#8c8c8c' }}>
                        <SecurityScanOutlined style={{ marginRight: 8 }} />
                        {group}
                      </Text>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          const next = new Set(selectedEditPerms);
                          const keys = perms.map((p) => p.key);
                          const allSelected = keys.every((k) => next.has(k));
                          if (allSelected) {
                            keys.forEach((k) => next.delete(k));
                          } else {
                            keys.forEach((k) => next.add(k));
                          }
                          setSelectedEditPerms(next);
                        }}
                      >
                        {perms.every((p) => selectedEditPerms.has(p.key)) ? 'Bỏ hết' : 'Chọn hết'}
                      </Button>
                    </div>
                    <Row gutter={[8, 8]}>
                      {perms.map((p) => (
                        <Col span={12} key={p.key}>
                          <div
                            style={{
                              padding: '12px 16px',
                              border: '1px solid #d9d9d9',
                              borderRadius: 6,
                              backgroundColor: '#fff',
                              cursor: 'pointer',
                              transition: 'all 0.3s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8
                            }}
                            onClick={() => {
                              const next = new Set(selectedEditPerms);
                              if (next.has(p.key)) next.delete(p.key);
                              else next.add(p.key);
                              setSelectedEditPerms(next);
                            }}
                          >
                            <Checkbox
                              checked={selectedEditPerms.has(p.key)}
                              onChange={(e) => {
                                const next = new Set(selectedEditPerms);
                                if (e.target.checked) next.add(p.key);
                                else next.delete(p.key);
                                setSelectedEditPerms(next);
                              }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500, color: '#262626' }}>{p.name}</div>
                              <div style={{ fontSize: 10, color: '#bfbfbf', fontFamily: 'monospace', marginTop: 2 }}>
                                {p.key}
                              </div>
                            </div>
                            {selectedEditPerms.has(p.key) && <CheckOutlined style={{ color: '#1890ff' }} />}
                          </div>
                        </Col>
                      ))}
                    </Row>
                  </div>
                ))
              )}
            </div>
          </Space>
        </Form>
        <div
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8
          }}
        >
          <Button onClick={() => setIsEditUserOpen(false)} disabled={isUpdating}>
            Hủy
          </Button>
          <Button
            type="primary"
            loading={isUpdating}
            onClick={async () => {
              try {
                const values = await editForm.validateFields();
                const name = values.name.trim();
                const email = values.email.trim().toLowerCase();

                setIsUpdating(true);
                await updateAdminUser(editUserId!, {
                  name,
                  email,
                  role: values.role,
                  permissions: Array.from(selectedEditPerms)
                });
                toast.success('Thành công', {
                  description: 'Đã cập nhật người dùng'
                });
                setIsEditUserOpen(false);
                await handleRefresh();
              } catch (err: any) {
                if (err.errorFields) {
                  return; // Form validation error
                }
                toast.error('Lỗi', {
                  description: err?.message || 'Không thể cập nhật người dùng'
                });
              } finally {
                setIsUpdating(false);
              }
            }}
          >
            Cập nhật
          </Button>
        </div>
      </Modal>

      <AdminEditModal
        editType={editData ? 'user' : null}
        editData={editData}
        setIsEditOpen={setIsEditOpen}
        isEditOpen={isEditOpen}
        setEditData={setEditData}
        setUsers={setUsers}
        moviesLocal={moviesLocal}
        toLocalDateTimeString={toLocalDateTimeString}
        pageSize={pageSize}
        currentPage={usersPage}
        setMoviesLocal={setMoviesLocal}
        setMovieStatus={setMovieStatus}
        setToys={() => {}}
        onRefresh={handleRefresh}
      />
    </AdminLayout>
  );
}
