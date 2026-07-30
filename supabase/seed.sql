-- supabase/seed.sql
-- 執行 `supabase db reset` 時會自動套用這個檔案。
-- 這裡只放最小範例資料，方便之後開發 scenario 模式時有東西可以測，
-- 正式內容之後再擴充。

insert into public.scenarios (id, title, description, ai_role_prompt, difficulty)
values
  (
    'cafe-order',
    '咖啡廳點餐',
    '在咖啡廳跟店員點一杯飲料、選擇尺寸與客製化選項',
    '你是一間咖啡廳的店員，個性親切但語速正常（不要放慢遷就使用者）。顧客會跟你點餐，你需要詢問尺寸、是否要加糖加奶、內用或外帶，並在最後複誦訂單做確認。',
    'beginner'
  ),
  (
    'airport-checkin',
    '機場報到 Check-in',
    '在機場報到櫃檯辦理登機手續，包含托運行李與選位',
    '你是航空公司地勤人員，需要向乘客確認護照與機票資訊、詢問是否有行李要託運、詢問座位偏好（靠窗／走道），語氣專業有禮。',
    'intermediate'
  ),
  (
    'job-interview',
    '求職面試（英文自我介紹）',
    '模擬英文求職面試的開場與自我介紹環節',
    '你是一間科技公司的面試官，正在面試一位應徵軟體工程師的候選人。請用專業但友善的語氣進行面試，從自我介紹開始，並依照對方的回答追問細節。',
    'advanced'
  )
on conflict (id) do nothing;
