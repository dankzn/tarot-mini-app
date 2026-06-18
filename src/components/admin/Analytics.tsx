import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const COLORS = ['#6B4EE6', '#D4AF37', '#385144', '#FF6B6B', '#4ECDC4'];

interface GenderData {
  name: string;
  value: number;
}

interface ServiceData {
  name: string;
  count: number;
}

interface RevenueData {
  month: string;
  total: number;
}

interface StatusData {
  name: string;
  count: number;
}

export const Analytics = () => {
  const [genderData, setGenderData] = useState<GenderData[]>([]);
  const [servicesData, setServicesData] = useState<ServiceData[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [statusData, setStatusData] = useState<StatusData[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    // Аналитика по полу
    const { data: users } = await supabase
      .from('users')
      .select('gender');
    
    const genderCount = { male: 0, female: 0, other: 0 };
    
    if (users) {
      users.forEach((u: any) => {
        const gender = u.gender;
        if (gender === 'male') genderCount.male++;
        else if (gender === 'female') genderCount.female++;
        else if (gender === 'other') genderCount.other++;
      });
    }
    
    setGenderData([
      { name: 'Мужской', value: genderCount.male },
      { name: 'Женский', value: genderCount.female },
      { name: 'Не указан', value: genderCount.other },
    ]);

    // Аналитика по услугам
    const { data: consultations } = await supabase
      .from('consultations')
      .select(`
        service_id,
        services:service_id (
          title
        )
      `)
      .eq('status', 'completed');
    
    const serviceCount: Record<string, number> = {};
    
    if (consultations) {
      consultations.forEach((c: any) => {
        const title = c.services?.title || 'Неизвестно';
        serviceCount[title] = (serviceCount[title] || 0) + 1;
      });
    }
    
    setServicesData(
      Object.entries(serviceCount).map(([name, count]) => ({ name, count }))
    );

    // Аналитика по доходам (по месяцам)
    const { data: revenue } = await supabase
      .from('consultations')
      .select('created_at, price')
      .eq('status', 'completed');
    
    const monthlyRevenue: Record<string, number> = {};
    
    if (revenue) {
      revenue.forEach((r: any) => {
        const date = new Date(r.created_at);
        const month = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
        monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (r.price || 0);
      });
    }
    
    setRevenueData(
      Object.entries(monthlyRevenue).map(([month, total]) => ({ month, total }))
    );

    // Аналитика по статусам клиентов
    const { data: usersWithStatus } = await supabase
      .from('users')
      .select('status');
    
    const statusCount: Record<string, number> = {};
    
    if (usersWithStatus) {
      usersWithStatus.forEach((u: any) => {
        const status = u.status || 'Неизвестно';
        statusCount[status] = (statusCount[status] || 0) + 1;
      });
    }
    
    setStatusData(
      Object.entries(statusCount).map(([name, count]) => ({ name, count }))
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-[#385144]">Аналитика</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Пол клиентов */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-lg mb-4">Пол клиентов</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={genderData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {genderData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Популярность услуг */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-lg mb-4">Популярность услуг</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={servicesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#6B4EE6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Доходы по месяцам */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-lg mb-4">Доходы по месяцам</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#D4AF37" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Статусы клиентов */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-lg mb-4">Статусы клиентов</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {statusData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};