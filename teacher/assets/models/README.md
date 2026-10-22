# Pose model

`movenet-singlepose-lightning-int8.tflite`: **MoveNet SinglePose Lightning, INT8**, by Google.
License: Apache-2.0. Input `[1, 192, 192, 3]` uint8 RGB. Output `[1, 1, 17, 3]` float32 as (y, x, score).

Download it with `npm run fetch-model` (from `teacher/`). If the automatic download is blocked on your network, get it manually from
[Kaggle Models · google/movenet · TFLite · singlepose-lightning-tflite-int8](https://www.kaggle.com/models/google/movenet/tfLite/singlepose-lightning-tflite-int8)
and save it here with the exact file name above.

The app checks the input tensor at startup and shows an error on the teacher screen if the file is not the expected model.

Commit the file to the repository before submitting, so judges can build without an extra step. Apache-2.0 allows redistribution with this notice.
