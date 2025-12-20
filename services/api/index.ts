// API 基础配置和请求封装
// 本地版本 - 连接到 Python 后端

// 本地后端API地址
const API_BASE = '/api';

// 通用请求方法
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; message?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '请求失败',
    };
  }
}

// GET 请求
export const get = <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' });

// POST 请求
export const post = <T>(endpoint: string, body?: any) =>
  request<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });

// PUT 请求
export const put = <T>(endpoint: string, body?: any) =>
  request<T>(endpoint, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });

// DELETE 请求
export const del = <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' });

// 文件上传 - 保存到本地 output 目录
export const saveOutputImage = async (imageData: string, filename?: string): Promise<{ success: boolean; data?: any; error?: string }> => {
  return post('/files/save-output', { imageData, filename });
};

// 文件上传 - 保存到本地 input 目录  
export const saveInputImage = async (imageData: string, filename?: string): Promise<{ success: boolean; data?: any; error?: string }> => {
  return post('/files/save-input', { imageData, filename });
};

// 获取服务器状态
export const getServerStatus = async () => {
  return get<{
    status: string;
    version: string;
    mode: string;
    input_dir: string;
    output_dir: string;
  }>('/status');
};

export { API_BASE };
