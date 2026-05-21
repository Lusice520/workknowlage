import { ExternalFileApp as ExternalFileFeatureApp } from '../features/external-file/ExternalFileApp';
import { getWorkKnowlageApi } from '../shared/lib/workKnowlageApi';

export default function ExternalFileApp() {
  return <ExternalFileFeatureApp externalFilesApi={getWorkKnowlageApi().externalFiles} />;
}
