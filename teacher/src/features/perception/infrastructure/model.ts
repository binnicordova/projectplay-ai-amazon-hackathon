import { Asset } from 'expo-asset';
import { useEffect, useState } from 'react';
import { loadTensorflowModel, type TensorflowModelDelegate, type TensorflowPlugin, type TfliteModel } from 'react-native-fast-tflite';
import movenet from '../../../../assets/models/movenet-singlepose-lightning-int8.tflite';

/**
 * MoveNet SinglePose Lightning INT8 (Apache-2.0, Google). ~3 MB, bundled with the app so it
 * works with no connection at all. Download it once with `npm run fetch-model`.
 */
export const MOVENET_MODEL: number = movenet;

/**
 * CPU by default: INT8 MoveNet Lightning runs in ~10–20 ms per lane on mid-range phones and
 * behaves the same everywhere. GPU/NNAPI/Core ML delegates are worth benchmarking on the
 * demo phone but are not guaranteed to support every quantised op.
 */
export const MODEL_DELEGATES: TensorflowModelDelegate[] = [];

/**
 * fast-tflite 3 reads every model path with `java.net.URL`. In a debug build `require()` gives
 * Metro's http:// URL, but in a release APK it gives a bare `res/raw` name ("no protocol").
 * expo-asset copies the bundled model to the cache once and hands back a file:// URI in both.
 */
async function loadMovenet(): Promise<TfliteModel> {
  const [asset] = await Asset.loadAsync(MOVENET_MODEL);
  const url = asset?.localUri;
  if (!url) throw new Error('The pose model is missing from the app bundle');
  return loadTensorflowModel({ url }, MODEL_DELEGATES);
}

export function useMovenetModel(): TensorflowPlugin {
  const [plugin, setPlugin] = useState<TensorflowPlugin>({ model: undefined, state: 'loading' });
  useEffect(() => {
    let mounted = true;
    loadMovenet().then(
      (model) => mounted && setPlugin({ model, state: 'loaded' }),
      (error: unknown) => mounted && setPlugin({ model: undefined, state: 'error', error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      mounted = false;
    };
  }, []);
  return plugin;
}
