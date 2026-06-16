import { usePersistedTab } from '../../shared/hooks/usePersistedTab';
import './myself.css';
import { SectionSport } from './sport/SectionSport';
import { SectionSelfCare } from './components/SectionSelfCare';
import { SectionWishlist } from './components/SectionWishlist';

type MyselfTab = 'selfcare' | 'wishlist' | 'sport';

const TABS: { key: MyselfTab; label: string }[] = [
  { key: 'selfcare', label: 'Self Care' },
  { key: 'wishlist', label: 'Wishlist'  },
  { key: 'sport',    label: 'Sport'     },
];

export default function Myself() {
  const [activeTab, setActiveTab] = usePersistedTab<MyselfTab>('myself', 'selfcare');

  return (
    <div className="myself-page">
      <nav className="myself-tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`myself-tab${activeTab === tab.key ? ' myself-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'selfcare' && <SectionSelfCare />}
      {activeTab === 'wishlist' && <SectionWishlist />}
      {activeTab === 'sport'    && <SectionSport />}
    </div>
  );
}
