# Bytedance Seedance 2.0

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /api/v1/jobs/createTask:
    post:
      summary: Bytedance Seedance 2.0
      deprecated: false
      description: >
        ## Query Task Status


        After submitting a task, use the unified query endpoint to check
        progress and retrieve results:


        <Card title="Get Task Details" icon="lucide-search"
        href="/market/common/get-task-detail">
          Learn how to query task status and retrieve generation results
        </Card>


        ::: tip[]

        In production environments, it is recommended to use the callBackUrl
        parameter to receive automatic notifications upon completion, rather
        than polling the status API.

        :::


        > **Note**

        >

        > *   **Image-to-Video (First Frame)**, **Image-to-Video (First & Last
        Frames)**, and **Multimodal Reference-to-Video** (including reference
        images, videos, and audio) are three mutually exclusive scenarios and
        **cannot be used simultaneously**.

        > *   Multimodal Reference-to-Video can indirectly achieve a "First/Last
        Frame + Multimodal Reference" effect by specifying reference images as
        the first or last frame via prompts. If you need to strictly guarantee
        that the first and last frames are identical to the specified images,
        **prioritize using Image-to-Video (First & Last Frames)**




        ## Key Features


        <CardGroup cols={2}>
          <Card title="Text-to-Video" icon="lucide-wand-sparkles">
            Generate videos directly from text descriptions without input images
          </Card>
          <Card title="Image-to-Video" icon="lucide-images">
            Animate static images with 0-2 input images support
          </Card>
          <Card title="Dynamic Camera" icon="lucide-camera">
            Advanced camera movement with optional lens locking for stable shots
          </Card>
          <Card title="Audio Generation" icon="lucide-volume-2">
            Optional audio generation for enhanced video content
          </Card>
        </CardGroup>


        ## Related Resources


        <CardGroup cols={2}>
          <Card title="Market Overview" icon="lucide-store" href="/market/quickstart">
            Explore all available models
          </Card>
          <Card title="Common API" icon="lucide-cog" href="/common-api/get-account-credits">
            Check credits and account usage
          </Card>
        </CardGroup>
      operationId: bytedance-seedance-2
      tags:
        - docs/en/Market/Video Models/Bytedance
      parameters: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required:
                - model
                - input
              properties:
                model:
                  type: string
                  description: |-
                    The model name to use for generation. Required field.

                    - Must be `bytedance/seedance-2` for this endpoint
                  enum:
                    - bytedance/seedance-2
                  default: bytedance/seedance-2
                  x-apidog-enum:
                    - value: bytedance/seedance-2
                      name: ''
                      description: ''
                  examples:
                    - bytedance/seedance-2
                callBackUrl:
                  type: string
                  format: uri
                  description: >-
                    The URL to receive generation task completion updates.
                    Optional but recommended for production use.


                    - System will POST task status and results to this URL when
                    generation completes

                    - Callback includes generated content URLs and task
                    information

                    - Your callback endpoint should accept POST requests with
                    JSON payload containing results

                    - Alternatively, use the Get Task Details endpoint to poll
                    task status

                    - To ensure callback security, see [Webhook Verification
                    Guide](/common-api/webhook-verification) for signature
                    verification implementation
                  examples:
                    - https://your-domain.com/api/callback
                input:
                  type: object
                  description: Input parameters for the generation task
                  properties:
                    prompt:
                      type: string
                      description: >-
                        The text prompt used to generate the video. Required
                        field. (Min length: 3, Max length: 20000 characters)
                      minLength: 3
                      maxLength: 20000
                      examples:
                        - >-
                          A serene beach at sunset with waves gently crashing on
                          the shore, palm trees swaying in the breeze, and
                          seagulls flying across the orange sky
                    first_frame_url:
                      type: string
                      description: |-
                        First frame image url or asset://{assetId} 
                        (for example: asset://asset-20260404242101-76djj)
                    last_frame_url:
                      type: string
                      description: |-
                        End frame image url or asset://{assetId} 
                        (for example: asset://asset-20260404242101-76djj)
                    reference_image_urls:
                      type: array
                      items:
                        type: string
                        format: uri
                      description: >-
                        Enter a list of image URLs or asset://{assetId} (for
                        example: asset://asset-20260404242101-76djj).

                        Single image requirements:

                        Format: jpeg, png, webp, bmp, tiff, gif.

                        Aspect ratio (width/height): (0.4, 2.5)

                        Width and height (px): (300, 6000)

                        Size: Single image less than 30 MB.

                        Maximum number of files: The sum of the number of frames
                        at the beginning and end must not exceed 9..
                      maxItems: 9
                      examples:
                        - - >-
                            https://file.aiquickdraw.com/custom-page/akr/section-images/example1.png
                    reference_video_urls:
                      type: array
                      items:
                        type: string
                        format: uri
                      description: >-
                        Enter a list of video URLs or asset://{assetId} (for
                        example: asset://asset-20260404242101-76djj) .

                        Single video requirements:

                        Video format: mp4, mov.

                        Resolution: 480p, 720p

                        Duration: Single video duration [2, 15] s, maximum 3
                        reference videos, total duration of all videos not
                        exceeding 15 seconds.

                        Dimensions:

                        Aspect ratio (width/height): [0.4, 2.5]

                        Width/height (px): [300, 6000]

                        Total pixels: [640×640=409600, 834×1112=927408], i.e.,
                        the product of width and height must meet the range
                        requirement of [409600, 927408].

                        Size: Single video not exceeding 50 MB.

                        Frame rate (FPS): [24, 60]
                      maxItems: 3
                    reference_audio_urls:
                      type: array
                      items:
                        type: string
                        format: uri
                      description: >-
                        Enter a list of audio URLs or asset://{assetId} (for
                        example: asset://asset-20260404242101-76djj) .

                        Single audio requirements:

                        Format: wav, mp3

                        Duration: Single audio duration [2, 15] s, maximum 3
                        reference audios, total duration of all audios not
                        exceeding 15 s.

                        Size: Single audio file size not exceeding 15 MB.
                      maxItems: 3
                    return_last_frame:
                      type: boolean
                      description: >-
                        Whether to return the last frame of the video as an
                        image.
                      default: false
                      deprecated: true
                    generate_audio:
                      description: |-
                        Whether to generate audio for the video.

                        - **true**: Generate with audio
                        - **false**: Generate without audio
                      type: boolean
                      default: true
                      examples:
                        - false
                    resolution:
                      type: string
                      description: >-
                        Video resolution - 480p for faster generation, 720p for
                        balance, 1080p for High-quality video, 4K Ultra-High
                        Definition, delivering perfect visual details.
                      enum:
                        - 480p
                        - 720p
                        - 1080p
                        - 4k
                      default: 720p
                      examples:
                        - 720p
                      x-apidog-enum:
                        - value: 480p
                          name: ''
                          description: ''
                        - value: 720p
                          name: ''
                          description: ''
                        - value: 1080p
                          name: ''
                          description: ''
                        - value: 4k
                          name: ''
                          description: ''
                    aspect_ratio:
                      type: string
                      description: Video aspect ratio configuration. Required field.
                      enum:
                        - '1:1'
                        - '4:3'
                        - '3:4'
                        - '16:9'
                        - '9:16'
                        - '21:9'
                        - adaptive
                      default: '16:9'
                      x-apidog-enum:
                        - value: '1:1'
                          name: ''
                          description: ''
                        - value: '4:3'
                          name: ''
                          description: ''
                        - value: '3:4'
                          name: ''
                          description: ''
                        - value: '16:9'
                          name: ''
                          description: ''
                        - value: '9:16'
                          name: ''
                          description: ''
                        - value: '21:9'
                          name: ''
                          description: ''
                        - value: adaptive
                          name: ''
                          description: ''
                      examples:
                        - '16:9'
                    duration:
                      type: integer
                      description: Video duration in 4-15 seconds or -1.
                      default: 5
                      examples:
                        - 5
                    web_search:
                      type: boolean
                      description: Use online search
                    nsfw_checker:
                      type: boolean
                      description: >-
                        Defaults to false. You can set it to false based on your
                        needs. If set to false, our content filtering will be
                        disabled, and all results will be returned directly by
                        the model itself.

                        Note: There is no guarantee that everything can be
                        filtered out; if you are not satisfied with the results,
                        you will need to make your own arrangements.
                  x-apidog-orders:
                    - prompt
                    - first_frame_url
                    - last_frame_url
                    - reference_image_urls
                    - reference_video_urls
                    - reference_audio_urls
                    - return_last_frame
                    - generate_audio
                    - resolution
                    - aspect_ratio
                    - duration
                    - web_search
                    - 01KWKMN7PBRAKVAWC9BZ3PW3YJ
                  x-apidog-refs:
                    01KWKMN7PBRAKVAWC9BZ3PW3YJ:
                      $ref: '#/components/schemas/nsfw_checker'
                  x-apidog-ignore-properties:
                    - nsfw_checker
              x-apidog-orders:
                - model
                - callBackUrl
                - input
              x-apidog-ignore-properties: []
            example:
              model: bytedance/seedance-2
              callBackUrl: https://your-domain.com/api/callback
              input:
                prompt: >-
                  A serene beach at sunset with waves gently crashing on the
                  shore, palm trees swaying in the breeze, and seagulls flying
                  across the orange sky
                first_frame_url: >-
                  https://templateb.aiquickdraw.com/custom-page/akr/section-images/example2.png
                last_frame_url: >-
                  https://templateb.aiquickdraw.com/custom-page/akr/section-images/example3.png
                reference_image_urls:
                  - >-
                    https://templateb.aiquickdraw.com/custom-page/akr/section-images/example1.png
                reference_video_urls:
                  - >-
                    https://templateb.aiquickdraw.com/custom-page/akr/section-images/example1.mp4
                reference_audio_urls:
                  - >-
                    https://templateb.aiquickdraw.com/custom-page/akr/section-images/example1.mp3
                return_last_frame: false
                generate_audio: false
                resolution: 720p
                aspect_ratio: '16:9'
                duration: 15
                web_search: false
      responses:
        '200':
          description: Request successful
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/response%20not%20with%20recordId'
              example:
                code: 200
                msg: success
                data:
                  taskId: task_bytedance_1765186743319
          headers: {}
          x-apidog-name: ''
      security:
        - BearerAuth: []
          x-apidog:
            schemeGroups:
              - id: kn8M4YUlc5i0A0179ezwx
                schemeIds:
                  - BearerAuth
            required: true
            use:
              id: kn8M4YUlc5i0A0179ezwx
            scopes:
              kn8M4YUlc5i0A0179ezwx:
                BearerAuth: []
      callbacks:
        videoTaskCompleted:
          '{request.body#/callBackUrl}':
            post:
              description: >-
                The system sends this callback when the `bytedance/seedance-2`
                task succeeds or fails.
              requestBody:
                required: true
                content:
                  application/json:
                    schema:
                      type: object
                      required:
                        - code
                        - msg
                        - data
                      properties:
                        code:
                          type: integer
                          description: >-
                            Unified callback code: 200 for success, 501 for
                            failure.
                          enum:
                            - 200
                            - 501
                        msg:
                          type: string
                          description: Unified callback message.
                          enum:
                            - Playground task completed successfully.
                            - Playground task failed.
                        data:
                          type: object
                          required:
                            - taskId
                            - model
                            - state
                            - param
                            - resultJson
                            - failCode
                            - failMsg
                          properties:
                            taskId:
                              type: string
                              description: The unique task identifier.
                            model:
                              type: string
                              description: The model used for the task.
                              enum:
                                - bytedance/seedance-2
                            state:
                              type: string
                              description: Terminal task state.
                              enum:
                                - success
                                - fail
                            param:
                              type: string
                              description: >-
                                JSON string containing the submitted task
                                parameters.
                            resultJson:
                              type: string
                              nullable: true
                              description: >-
                                JSON string containing resultUrls,
                                firstFrameUrl, lastFrameUrl, or resultObject
                                when successful. Null when failed.
                            failCode:
                              type: string
                              nullable: true
                              description: Null when successful; failure code when failed.
                            failMsg:
                              type: string
                              nullable: true
                              description: >-
                                Null when successful; failure message when
                                failed.
                            costTime:
                              type: integer
                              format: int64
                              description: >-
                                Task processing time. Present on successful
                                callbacks.
                            completeTime:
                              type: integer
                              format: int64
                              description: Task completion timestamp.
                            createTime:
                              type: integer
                              format: int64
                              description: Task creation timestamp.
                            updateTime:
                              type: integer
                              format: int64
                              description: Task update timestamp.
                            creditsConsumed:
                              type: number
                              description: >-
                                Credits consumed by the task. Present on
                                successful callbacks.
                    examples:
                      success:
                        summary: Task completed successfully
                        value:
                          code: 200
                          msg: Playground task completed successfully.
                          data:
                            taskId: task_example_video_webhook_001
                            model: bytedance/seedance-2
                            state: success
                            param: >-
                              {"input":"{\"prompt\":\"A serene beach at sunset
                              with waves gently crashing on the shore, palm
                              trees swaying in the breeze, and seagulls
                              flyi...\",\"first_frame_url\":\"https://example.com/input-image.jpg\",\"last_frame_url\":\"https://example.com/input-image.jpg\",\"reference_image_urls\":[\"https://example.com/input-image.jpg\"],\"reference_video_urls\":[\"https://example.com/input-video.mp4\"],\"reference_audio_urls\":[\"https://example.com/input-audio.mp3\"],\"return_last_frame\":false,\"generate_audio\":false,\"resolution\":\"720p\",\"aspect_ratio\":\"16:9\",\"duration\":15,\"web_search\":false}","callBackUrl":"https://example.com/callback","model":"bytedance/seedance-2"}
                            resultJson: >-
                              {"resultUrls":["https://example.com/generated-video.mp4"],"firstFrameUrl":["https://example.com/first-frame.jpg"],"lastFrameUrl":["https://example.com/last-frame.jpg"]}
                            failCode: null
                            failMsg: null
                            costTime: 12
                            completeTime: 1234567890
                            createTime: 1234560000
                            updateTime: 1234567890
                            creditsConsumed: 1.23
                      failure:
                        summary: Task failed
                        value:
                          code: 501
                          msg: Playground task failed.
                          data:
                            taskId: task_example_video_webhook_001
                            model: bytedance/seedance-2
                            state: fail
                            param: >-
                              {"input":"{\"prompt\":\"A serene beach at sunset
                              with waves gently crashing on the shore, palm
                              trees swaying in the breeze, and seagulls
                              flyi...\",\"first_frame_url\":\"https://example.com/input-image.jpg\",\"last_frame_url\":\"https://example.com/input-image.jpg\",\"reference_image_urls\":[\"https://example.com/input-image.jpg\"],\"reference_video_urls\":[\"https://example.com/input-video.mp4\"],\"reference_audio_urls\":[\"https://example.com/input-audio.mp3\"],\"return_last_frame\":false,\"generate_audio\":false,\"resolution\":\"720p\",\"aspect_ratio\":\"16:9\",\"duration\":15,\"web_search\":false}","callBackUrl":"https://example.com/callback","model":"bytedance/seedance-2"}
                            failCode: GENERATION_FAILED
                            failMsg: The generation task failed.
              responses:
                '200':
                  description: Callback received successfully.
                  content:
                    application/json:
                      schema:
                        type: object
                        properties:
                          code:
                            type: integer
                            example: 200
                          msg:
                            type: string
                            example: success
                      example:
                        code: 200
                        msg: success
      x-apidog-folder: docs/en/Market/Video Models/Bytedance
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/1184766/apis/api-32356532-run
components:
  schemas:
    nsfw_checker:
      type: object
      properties:
        nsfw_checker:
          type: boolean
          description: >-
            Defaults to false. You can set it to false based on your needs. If
            set to false, our content filtering will be disabled, and all
            results will be returned directly by the model itself.

            Note: There is no guarantee that everything can be filtered out; if
            you are not satisfied with the results, you will need to make your
            own arrangements.
      x-apidog-orders:
        - nsfw_checker
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    response not with recordId:
      type: object
      required:
        - data
      properties:
        code:
          type: integer
          description: >-
            Response Status Codes


            200: Success - The request was successfully processed.


            401: Unauthorized - Insufficient or invalid authentication
            credentials.


            402: Insufficient Quota - The account has insufficient quota to
            perform this operation.


            404: Not Found - The requested resource or interface does not exist.


            422: Validation Error - The request parameters failed the validation
            check.


            429: Request Restricted - The request frequency limit for this
            resource has been exceeded.


            433: Request Limit - The subkey usage exceeded the limit.


            455: Service Unavailable - The system is currently under
            maintenance.


            500: Server Error - An unexpected error occurred while processing
            the request.


            501: Generation Failed - The content generation task failed.


            505: Feature Disabled - The requested feature is currently disabled.
          enum:
            - 200
            - 401
            - 402
            - 404
            - 422
            - 429
            - 433
            - 455
            - 500
            - 501
            - 505
        msg:
          type: string
          description: Response message, error description upon failure
          examples:
            - success
        data:
          type: object
          required:
            - taskId
          properties:
            taskId:
              type: string
              description: >-
                The task ID can be used with the "Get Task Details" endpoint to
                query the task status.
              examples:
                - dc1928bfcbc77cb6c85f3359a9c718b3
          x-apidog-orders:
            - taskId
          x-apidog-ignore-properties: []
      x-apidog-orders:
        - code
        - msg
        - data
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
  securitySchemes:
    BearerAuth:
      type: bearer
      scheme: bearer
      bearerFormat: API Key
      description: >-
        All API requests require a Bearer Token. Add the header `Authorization:
        Bearer YOUR_API_KEY` to authenticate requests.
    BearerAuth1:
      type: bearer
      scheme: bearer
      bearerFormat: API Key
      description: >-
        所有 API 请求都需要 Bearer Token。请在请求头中添加 `Authorization: Bearer YOUR_API_KEY`
        进行身份验证。
servers:
  - url: https://api.kie.ai
    description: 正式环境
security:
  - BearerAuth: []
    x-apidog:
      schemeGroups:
        - id: kn8M4YUlc5i0A0179ezwx
          schemeIds:
            - BearerAuth
      required: true
      use:
        id: kn8M4YUlc5i0A0179ezwx
      scopes:
        kn8M4YUlc5i0A0179ezwx:
          BearerAuth: []

```
