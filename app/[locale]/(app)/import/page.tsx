import { repo } from '@/server/repo';
import { currentMonth, historyMonths } from '@/lib/clock';
import { ImportPanel } from '@/components/form/ImportPanel';

export default async function ImportPage() {
  const projects = (await repo.listProjects()).map((p) => ({ id: p.id, name: p.projectName, code: p.currentAliasCode }));
  const queue = await repo.getSapQueue();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <ImportPanel projects={projects} queue={queue} months={historyMonths()} currentMonth={currentMonth()} />
    </div>
  );
}
