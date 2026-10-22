import type { TensorflowModelDelegate } from 'react-native-fast-tflite';
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
