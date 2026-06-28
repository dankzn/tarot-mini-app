import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { CalendarCheck, Repeat2, TrendingUp, Users, Wallet } from 'lucide-react';

const COLORS = ['#385144', '#B8795C', '#8FA092', '#E7D8C9', '#6C756C'];

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

interface AnalyticsSummary {
  totalRevenue: number;
  totalConsultations: number;
  completedConsultations: number;
  averageCheck: number;
  conversionRate: number;
  repeatClients: number;
}

const emptySummary: AnalyticsSummary = {
  totalRevenue: 0,
  totalConsultations: 0,
  completedConsultations: 0,
  averageCheck: 0,
  conversionRate: 0,
  repeatClients: 0,
};

const formatMoney = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`;

export const Analytics = () => {
  const [genderData, setGenderData] = useState<GenderData[]>([]);
  const [servicesData, setServicesData] = useState<ServiceData[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [statusData, setStatusData] = useState<StatusData[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary>(emptySummary);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    const { data: users } = await supabase
      .from('users')
      .select('id, gender, status');

    const { data: consultations } = await supabase
      .from('consultations')
      .select(`
        id,
        user_id,
        status,
        price,
        created_at,
        services:service_id (
          title
        )
      `);

    const genderCount = { male: 0, female: 0, other: 0 };
    const statusCount: Record<string, number> = {};

    if (users) {
      users.forEach((user: any) => {
        const gender = user.gender;
        if (gender === 'male') genderCount.male++;
        else if (gender === 'female') genderCount.female++;
        else genderCount.other++;

        const status = user.status || 'Неизвестно';
        statusCount[status] = (statusCount[status] || 0) + 1;
      });
    }

    setGenderData([
      { name: 'Мужской', value: genderCount.male },
      { name: 'Женский', value: genderCount.female },
      { name: 'Не указан', value: genderCount.other },
    ].filter(item => item.value > 0));

    setStatusData(
      Object.entries(statusCount).map(([name, count]) => ({ name, count }))
    );

    const completed = consultations?.filter((consultation: any) => consultation.status === 'completed') || [];
    const totalRevenue = completed.reduce((sum: number, consultation: any) => sum + (consultation.price || 0), 0);
    const totalConsultations = consultations?.length || 0;
    const completedConsultations = completed.length;
    const averageCheck = completedConsultations > 0 ? totalRevenue / completedConsultations : 0;
    const conversionRate = totalConsultations > 0 ? Math.round((completedConsultations / totalConsultations) * 100) : 0;

    const completedByClient = completed.reduce((acc: Record<string, number>, consultation: any) => {
      if (!consultation.user_id) return acc;
      acc[consultation.user_id] = (acc[consultation.user_id] || 0) + 1;
      return acc;
    }, {});

    const repeatClients = Object.values(completedByClient).filter(count => count > 1).length;

    setSummary({
      totalRevenue,
      totalConsultations,
      completedConsultations,
      averageCheck,
      conversionRate,
      repeatClients,
    });

    const serviceCount: Record<string, number> = {};
    const monthlyRevenue: Record<string, number> = {};

    completed.forEach((consultation: any) => {
      const title = consultation.services?.title || 'Неизвестно';
      serviceCount[title] = (serviceCount[title] || 0) + 1;

      const date = new Date(consultation.created_at);
      const month = date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (consultation.price || 0);
    });

    setServicesData(
      Object.entries(serviceCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
    );

    setRevenueData(
      Object.entries(monthlyRevenue).map(([month, total]) => ({ month, total }))
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8A5A3F]/70">
          business pulse
        </p>
        <h2 className="text-2xl font-black text-[#385144]">Аналитика</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {[
          { label: 'Доход', value: formatMoney(summary.totalRevenue), hint: 'по завершённым', icon: Wallet },
          { label: 'Средний чек', value: formatMoney(summary.averageCheck), hint: 'за консультацию', icon: TrendingUp },
          { label: 'Конверсия', value: `${summary.conversionRate}%`, hint: 'в завершение', icon: CalendarCheck },
          { label: 'Повторные', value: summary.repeatClients, hint: 'клиенты 2+ раз', icon: Repeat2 },
          { label: 'Все записи', value: summary.totalConsultations, hint: `${summary.completedConsultations} завершено`, icon: Users },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className="rounded-[1.5rem] border border-white/80 bg-white/85 p-5 shadow-[0_14px_34px_rgba(56,81,68,0.08)]">
              <div className="mb-4 flex items-center justify-between">
                <Icon className="h-5 w-5 text-[#B8795C]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8FA092]">{item.hint}</span>
              </div>
              <p className="text-2xl font-black text-[#385144]">{item.value}</p>
              <p className="mt-1 text-sm font-semibold text-[#6C756C]">{item.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-[1.5rem] border border-white/80 bg-white/85 p-6 shadow-[0_14px_34px_rgba(56,81,68,0.08)]">
          <h3 className="mb-4 text-lg font-black text-[#385144]">Пол клиентов</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={genderData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                dataKey="value"
              >
                {genderData.map((_, index) => (
                  <Cell key={`gender-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-[1.5rem] border border-white/80 bg-white/85 p-6 shadow-[0_14px_34px_rgba(56,81,68,0.08)]">
          <h3 className="mb-4 text-lg font-black text-[#385144]">Популярность услуг</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={servicesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7D8C9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={70} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#385144" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-[1.5rem] border border-white/80 bg-white/85 p-6 shadow-[0_14px_34px_rgba(56,81,68,0.08)]">
          <h3 className="mb-4 text-lg font-black text-[#385144]">Доходы по месяцам</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7D8C9" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatMoney(Number(value || 0))} />
              <Bar dataKey="total" fill="#B8795C" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-[1.5rem] border border-white/80 bg-white/85 p-6 shadow-[0_14px_34px_rgba(56,81,68,0.08)]">
          <h3 className="mb-4 text-lg font-black text-[#385144]">Статусы клиентов</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                dataKey="count"
              >
                {statusData.map((_, index) => (
                  <Cell key={`status-${index}`} fill={COLORS[index % COLORS.length]} />
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
