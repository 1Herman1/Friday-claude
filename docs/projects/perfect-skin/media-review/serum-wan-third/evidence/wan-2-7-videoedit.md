# Wan 2.7 - Video Edit

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
      summary: Wan 2.7 - Video Edit
      deprecated: false
      description: >-
        ## Create Task


        Use this endpoint to create a new video editing generation task.


        <Card title="Get Task Details" icon="lucide-search"
        href="/market/common/get-task-detail">
          After submission, use the unified query endpoint to check task progress and retrieve results
        </Card>


        ::: tip[]

        For production use, we recommend providing the `callBackUrl` parameter
        so your service can receive completion notifications instead of polling
        for task status.

        :::


        ## Related Resources


        <CardGroup cols={2}>
          <Card title="Model Marketplace" icon="lucide-store" href="/market/quickstart">
            Explore all available models and capabilities
          </Card>
          <Card title="Common API" icon="lucide-cog" href="/common-api/get-account-credits">
            Check account credits and usage
          </Card>
        </CardGroup>
      operationId: wan-2-7-videoedit
      tags:
        - docs/en/Market/Video Models/Wan
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
                  enum:
                    - wan/2-7-videoedit
                  default: wan/2-7-videoedit
                  description: >-
                    The model name used for generation. This field is required.
                    This endpoint must use the `wan/2-7-videoedit` model.
                  examples:
                    - wan/2-7-videoedit
                callBackUrl:
                  type: string
                  format: uri
                  description: >-
                    Callback URL for task completion notifications. Optional
                    parameter. If provided, the system will send a POST request
                    to this URL when the task completes, whether it succeeds or
                    fails. If omitted, no callback notification will be sent.
                  examples:
                    - https://your-domain.com/api/callback
                input:
                  type: object
                  description: Input parameters for the video editing task.
                  required:
                    - video_url
                  properties:
                    prompt:
                      type: string
                      maxLength: 5000
                      description: >-
                        Optional text prompt describing the expected elements
                        and visual features in the generated video. Supports
                        Chinese and English. Maximum length: 5000 characters.
                      examples:
                        - >-
                          Change the character's outfit and add the hat shown in
                          the reference image.
                    negative_prompt:
                      type: string
                      maxLength: 500
                      description: >-
                        Optional negative prompt describing content that should
                        not appear in the video. Supports Chinese and English.
                        Maximum length: 500 characters.
                      examples:
                        - >-
                          low resolution, errors, worst quality, low quality,
                          malformed, extra fingers, bad proportions
                    video_url:
                      type: string
                      format: uri
                      description: >-
                        URL of the source video to edit. Required. Only one
                        video is supported.


                        - Formats: `mp4`, `mov`

                        - Duration: `2` to `10` seconds

                        - Resolution: width and height range `[240,4096]` pixels

                        - Aspect ratio: `1:8` to `8:1`

                        - File size: up to `100MB`

                        - Supports public `http/https` URLs or temporary `oss`
                        URLs
                      examples:
                        - https://example.com/demo/video.mp4
                    reference_image:
                      type: string
                      format: uri
                      description: >-
                        Optional reference image URL for character, clothing, or
                        style guidance.


                        - Formats: `JPEG`, `JPG`, `PNG` (no alpha channel),
                        `WEBP`

                        - Resolution: width and height range `[240,8000]` pixels

                        - Aspect ratio: `1:8` to `8:1`

                        - Supports public `http/https` URLs or temporary `oss`
                        URLs
                      examples:
                        - https://example.com/demo/reference.png
                    resolution:
                      type: string
                      enum:
                        - 720p
                        - 1080p
                      default: 1080p
                      description: >-
                        Output video resolution tier. `1080p` costs more than
                        `720p`. Default value: `1080p`.


                        - `720p`: 720p

                        - `1080p`: 1080p
                      examples:
                        - 1080p
                    aspect_ratio:
                      type: string
                      enum:
                        - '16:9'
                        - '9:16'
                        - '1:1'
                        - '4:3'
                        - '3:4'
                      description: >-
                        Output video aspect ratio.


                        - If omitted: the output uses an aspect ratio close to
                        the input video

                        - If provided: the output uses the specified aspect
                        ratio

                        - Available values: `16:9`, `9:16`, `1:1`, `4:3`, `3:4`
                      examples:
                        - '16:9'
                    duration:
                      type: integer
                      minimum: 0
                      maximum: 10
                      default: 0
                      description: >-
                        Output video duration in seconds.


                        - Default `0` means using the full input video duration
                        without truncation

                        - If a value is provided, the output is clipped from
                        second `0` to the specified length

                        - Valid values are `0` or any integer in `[2,10]`
                      examples:
                        - 0
                    audio_setting:
                      type: string
                      enum:
                        - auto
                        - origin
                      default: auto
                      description: >-
                        Video audio setting.


                        - `auto`: default, the model decides whether to
                        regenerate audio based on the `prompt`

                        - `origin`: force keeping the original input video audio
                      examples:
                        - auto
                    prompt_extend:
                      type: boolean
                      default: true
                      description: >-
                        Whether to enable prompt rewriting. When enabled, the
                        model expands the input prompt. This usually works
                        better for short prompts but increases processing time.
                      examples:
                        - true
                    watermark:
                      type: boolean
                      default: false
                      description: >-
                        Whether to add a watermark. The watermark is placed in
                        the lower-right corner of the video with the fixed text
                        "AI generated".
                      examples:
                        - false
                    seed:
                      type: integer
                      minimum: 0
                      maximum: 2147483647
                      description: >-
                        Random seed. Range: `0-2147483647`. If omitted, the
                        system generates one automatically.
                      examples:
                        - 0
                    nsfw_checker:
                      type: boolean
                      description: >-
                        Defaults to false. When false, no additional content
                        filtering is applied and results are returned directly
                        by the model.
                  x-apidog-orders:
                    - prompt
                    - negative_prompt
                    - video_url
                    - reference_image
                    - resolution
                    - aspect_ratio
                    - duration
                    - audio_setting
                    - prompt_extend
                    - watermark
                    - seed
                    - 01KWKP2M1R1ESRKQ0WVE6E66YB
                  x-apidog-refs:
                    01KWKP2M1R1ESRKQ0WVE6E66YB:
                      $ref: '#/components/schemas/nsfw_checker'
                  x-apidog-ignore-properties:
                    - nsfw_checker
              x-apidog-orders:
                - model
                - callBackUrl
                - input
              x-apidog-ignore-properties: []
            example:
              model: wan/2-7-videoedit
              callBackUrl: https://your-domain.com/api/callback
              input:
                prompt: >-
                  Change the character's outfit and add the hat shown in the
                  reference image.
                negative_prompt: >-
                  low resolution, errors, worst quality, low quality, malformed,
                  extra fingers, bad proportions
                video_url: https://example.com/demo/video.mp4
                reference_image: https://example.com/demo/reference.png
                resolution: 1080p
                aspect_ratio: '16:9'
                duration: 0
                audio_setting: auto
                prompt_extend: true
                watermark: false
                seed: 0
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
                  taskId: task_wan_1765180586443
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
                The system sends this callback when the `wan/2-7-videoedit` task
                succeeds or fails.
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
                          properties:
                            taskId:
                              type: string
                              description: The unique task identifier.
                            model:
                              type: string
                              description: The model used for the task.
                              enum:
                                - wan/2-7-videoedit
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
                                when successful. Present only when state is
                                success.
                            failCode:
                              type: string
                              nullable: true
                              description: >-
                                Failure code, a numeric string such as "400" or
                                "500". Present only when state is fail.
                            failMsg:
                              type: string
                              nullable: true
                              description: Failure reason. Present only when state is fail.
                            costTime:
                              type: integer
                              format: int64
                              description: >-
                                Processing time in seconds. Present on both
                                success and failure callbacks.
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
                              description: >-
                                Use completeTime as the completion time;
                                updateTime may equal createTime.
                            creditsConsumed:
                              type: number
                              description: >-
                                Credits consumed by the task; 0 for failed
                                tasks.
                    examples:
                      success:
                        summary: Task completed successfully
                        value:
                          code: 200
                          msg: Playground task completed successfully.
                          data:
                            taskId: task_example_video_webhook_001
                            model: wan/2-7-videoedit
                            state: success
                            param: >-
                              {"input":"{\"prompt\":\"Change the character's
                              outfit and add the hat shown in the reference
                              image.\",\"negative_prompt\":\"low resolution,
                              errors, worst quality, low quality, malformed,
                              extra fingers, bad
                              proportions\",\"video_url\":\"https://example.com/input-video.mp4\",\"reference_image\":\"https://example.com/input-image.jpg\",\"resolution\":\"1080p\",\"aspect_ratio\":\"16:9\",\"duration\":0,\"audio_setting\":\"auto\",\"prompt_extend\":true,\"watermark\":false,\"seed\":0}","callBackUrl":"https://example.com/callback","model":"wan/2-7-videoedit"}
                            resultJson: >-
                              {"resultUrls":["https://example.com/generated-video.mp4"]}
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
                            model: wan/2-7-videoedit
                            state: fail
                            param: >-
                              {"input":"{\"prompt\":\"Change the character's
                              outfit and add the hat shown in the reference
                              image.\",\"negative_prompt\":\"low resolution,
                              errors, worst quality, low quality, malformed,
                              extra fingers, bad
                              proportions\",\"video_url\":\"https://example.com/input-video.mp4\",\"reference_image\":\"https://example.com/input-image.jpg\",\"resolution\":\"1080p\",\"aspect_ratio\":\"16:9\",\"duration\":0,\"audio_setting\":\"auto\",\"prompt_extend\":true,\"watermark\":false,\"seed\":0}","callBackUrl":"https://example.com/callback","model":"wan/2-7-videoedit"}
                            failCode: '400'
                            failMsg: <error detail>
                            costTime: 12
                            creditsConsumed: 0
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
      x-apidog-folder: docs/en/Market/Video Models/Wan
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/1184766/apis/api-32709057-run
components:
  schemas:
    nsfw_checker:
      type: object
      properties:
        nsfw_checker:
          type: boolean
          description: >-
            Defaults to false. When false, no additional content filtering is
            applied and results are returned directly by the model.
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
            Status code of the request. The HTTP status is 200 even when the
            request fails, so always check this field: 200 means success; any
            other value means the request failed and msg describes the reason.
            Common values: 401 invalid or missing API key; 402 insufficient
            credits; 429 rate limit exceeded; 422 or 500 the request could not
            be processed (read msg and check your parameters before retrying).
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
