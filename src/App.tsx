import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { TodayPage } from './pages/TodayPage';
import { WeekPage } from './pages/WeekPage';
import { MonthPage } from './pages/MonthPage';
import { InboxPage } from './pages/InboxPage';
import { GoalsPage } from './pages/GoalsPage';
import { JournalPage } from './pages/JournalPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { AgentPage } from './pages/AgentPage';
import { BudgetPage } from './pages/BudgetPage';
import { AccountsPage } from './pages/AccountsPage';
import { StatsPage } from './pages/StatsPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/week" element={<WeekPage />} />
        <Route path="/month" element={<MonthPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/budget" element={<BudgetPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  );
}
