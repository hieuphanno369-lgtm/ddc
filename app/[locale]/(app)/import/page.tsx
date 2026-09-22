import { getTranslations } from 'next-intl/server';
import { repo } from '@/server/repo';
import { currentMonth, historyMonths } from '@/lib/clock';
import { ImportPanel } from '@/components/form/ImportPanel';

export default async function ImportPage() {
  const t = await getTranslations();
  const projects = (await repo.listProjects()).map((p) => ({ id: p.id, name: p.projectName, code: p.currentAliasCode }));
  const queue = await repo.getSapQueue();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-lg font-semibold text-navy-900">{t('import.title')}</h1>
      <ImportPanel projects={projects} queue={queue} months={historyMonths()} currentMonth={currentMonth()} />
    </div>
  );
}
