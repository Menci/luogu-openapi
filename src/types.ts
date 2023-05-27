export interface ProblemInfoRaw {
  pid: string;
  title: string;
  difficulty: number;
  fullScore: number;
  type: string;
  background: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  translation: string;
  samples: [string, string][];
  hint: string;
  limits: {
    time: number[];
    memory: number[];
  };
  tags: string[];
}

export interface ProblemInfo {
  pid: string;
  title: string;
  background: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  translation: string;
  samples: [string, string][];
  hint: string;
  tags: string[];
  /**
   * ms
   */
  timeLimit: number;
  /**
   * KiB
   */
  memoryLimit: number;
}

export interface JudgeRequest {
  /**
   * 题目 PID
   */
  pid: string; // "P1001"
  /**
   * 代码语言
   *
   * 见语言支持列表：https://docs.lgapi.cn/open/judge/langs
   */
  lang: string; // "cxx/14/gcc"
  /**
   * 打开 `-O2`（或类似的）编译优化开关
   *
   * 但不一定真的会开，受到题目限制，即使这里传入 false 也可能是打开的，反之亦然。
   *
   * 到底有无使用 O2 编译优化需要查询编译结果中的返回。
   */
  o2: boolean;
  /**
   * 要评测的代码
   */
  code: string; // "#include <stdio.h>\nint main() {\n    int a,b;\n    scanf(\"%d%d\",&a,&b);\n    printf(\"%d\\n\", a+b);\n    return 0;\n}\n"  
}

export interface HttpSubmitJudgeRequest extends JudgeRequest {
  /**
   * `<= 64 characters`
   * 
   * 由 OpenApp 定义，这里的内容会原封不动地在结果中返回。
   */
  trackId: string; // "string"
}

export interface HttpSubmitJudgeResponse {
  /**
   * Request ID, 用来查询请求结果
   */
  requestId: string; // "1BwHdxEa4LTFnL619bxRwC"
}

export interface HttpGetJudgeResultRequest {
  /**
   * Request ID, 于提交时获得
   */
  id: string; // "string"
}

// Used in both WebSocket push and HTTP response
export interface HttpGetJudgeResultResponse {
  /**
   * 评测执行类型
   */
  type: "judge";
  /**
   * 评测记录
   */
  data: JudgeRecord;
  /**
   * 异步请求的 ID，在提交时返回给 OpenApp。
   */
  requestId: string; // "1BwHdxEa4LTFnL619bxRwC"
  /**
   * 在提交请求时填写，会原样返回。
   */
  trackId: string; // "string"
}

export interface JudgeRecord {
  /**
   * 编译结果
   */
  compile?: JudgeRecordCompile;
  /**
   * 评测结果，如果为 null 则表示结果还没有生成。如果 status 为 Waiting 或 Judging，则评测还没完成。
   */
  judge?: JudgeRecordJudge;
}

export interface JudgeRecordCompile {
  /**
   * 编译是否成功
   */
  success: boolean;
  /**
   * 编译器返回信息
   */
  message: string; // "/tmp/compiler_y2u2icgr/src: 在函数‘void dfs(int, int, char, int)’中:\n/tmp/compiler_y2u2icgr/src:28:16: 警告：数组下标类型为‘char’ [-Wchar-subscripts]\n    move_to(psw[wy]);\n                ^\n",
  /**
   * 编译时是否打开 `O2`（或类似的）优化开关
   */
  opt2: boolean;
}

export enum JudgeStatus {
  Waiting = 0, // 任务等待执行
  Judging = 1, // 评测中
  CompileError = 2, // 编译失败
  OutputLimitExceeded = 3, // 输出超限
  MemoryLimitExceeded = 4, // 内存超限
  TimeLimitExceeded = 5, // 运行时间超限
  WrongAnswer = 6, // 答案错误
  RuntimeError = 7, // 运行时错误
  Invalid = 11, // 结果非法（一般是内部错误等，可以反馈）
  Accepted = 12, // 结果正确、评测通过
  OverallUnaccepted = 14 // 评测不通过（评测结果、子任务中使用，根据计分方式返回的评测失败）  
}

export interface JudgeRecordJudge {
  id: number;
  /**
   * 评测结果、子任务、测试点的状态。
   */
  status: JudgeStatus;
  /**
   * 得分
   */
  score: number;
  /**
   * 运行时使用的时间（毫秒，ms）
   */
  time: number;
  /**
   * 运行时使用的空间（内存，千字节，KiB）
   */
  memory: number;
  /**
   * 子任务结果列表
   */
  subtasks: JudgeRecordSubtask[];
}

export interface JudgeRecordSubtask {
  id: number;
  /**
   * 评测结果、子任务、测试点的状态。
   */
  status: JudgeStatus;
  /**
   * 得分
   */
  score: number;
  /**
   * 运行时使用的时间（毫秒，ms）
   */
  time: number;
  /**
   * 运行时使用的空间（内存，千字节，KiB）
   */
  memory: number;
  /**
   * 子任务结果列表
   */
  cases: JudgeRecordCase[];
}

export interface JudgeRecordCase {
  id: number;
  /**
   * 评测结果、子任务、测试点的状态。
   */
  status: JudgeStatus;
  /**
   * 得分
   */
  score: number;
  /**
   * 运行时使用的时间（毫秒，ms）
   */
  time: number;
  /**
   * 运行时使用的空间（内存，千字节，KiB）
   */
  memory: number;
  /**
   * 程序退出时的信号，非 0 一般为异常
   */
  signal: number;
  /**
   * 程序退出时的返回值，非 0 一般为非正常结束
   */
  exitCode: number;
  /**
   * 对测试点结果的描述
   */
  description?: string;
}

export interface GetJudgeResultResponse extends JudgeRecord {}

export interface HttpErrorResponse {
  /**
   * 错误代码，与 HTTP Status 相同
   */
  errorCode: number;
  /**
   * 错误类型
   */
  errorType: string;
  /**
   * 错误信息
   */
  errorMessage: number;
  /**
   * 错误相关数据，根据 errorType 的不同而变化
   */
  errorData: HttpErrorData;
}

export interface HttpErrorData {
  /**
   * 恒为 `1`，标识此为 LentilleFormError
   */
  lentilleFormError: 1;
  /**
   * 表单提交是否成功
   */
  submitted: boolean;
  /**
   * 表单校验是否成功
   */
  valid: boolean;
  /**
   * 表单出错的字段
   */
  fields: HttpErrorDataField[];
}

export interface HttpErrorDataField {
  /**
   * 出错字段名
   */
  name: string;
  /**
   * 出错字段值
   */
  value: string;
  /**
   * 出错字段信息
   */
  message: string;
}
